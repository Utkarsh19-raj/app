from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
from emergentintegrations.llm.chat import LlmChat, UserMessage, FileContentWithMimeType
import base64
import tempfile

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'job_application_db')]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 24

# LLM Configuration
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# ============ Models ============

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    full_name: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ResumeData(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    file_name: str
    parsed_data: dict
    uploaded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Job(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    title: str
    company: str
    description: str
    requirements: str
    location: Optional[str] = None
    url: Optional[str] = None
    added_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class JobCreate(BaseModel):
    title: str
    company: str
    description: str
    requirements: str
    location: Optional[str] = None
    url: Optional[str] = None

class Application(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    job_id: str
    job_title: str
    company: str
    status: str  # pending, applied, interview, rejected, accepted
    tailored_resume: Optional[str] = None
    cover_letter: Optional[str] = None
    applied_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ApplicationStatusUpdate(BaseModel):
    status: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: User

# ============ Helper Functions ============

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_access_token(user_id: str, email: str) -> str:
    expiration = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    payload = {
        "user_id": user_id,
        "email": email,
        "exp": expiration
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
        
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

async def parse_resume_with_ai(file_content: bytes, file_name: str) -> dict:
    """Parse resume using AI"""
    try:
        # Save file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file_name).suffix) as tmp_file:
            tmp_file.write(file_content)
            tmp_path = tmp_file.name
        
        try:
            # Initialize LLM chat
            chat = LlmChat(
                api_key=EMERGENT_LLM_KEY,
                session_id=f"resume-parse-{uuid.uuid4()}",
                system_message="You are an expert resume parser. Extract structured information from resumes."
            ).with_model("gemini", "gemini-2.0-flash")
            
            # Create file attachment
            file_attachment = FileContentWithMimeType(
                file_path=tmp_path,
                mime_type="application/pdf" if file_name.endswith('.pdf') else "text/plain"
            )
            
            # Parse resume
            message = UserMessage(
                text="""Extract the following information from this resume in JSON format:
{
  "name": "Full Name",
  "email": "Email",
  "phone": "Phone",
  "summary": "Professional summary",
  "skills": ["skill1", "skill2"],
  "experience": [{"title": "Job Title", "company": "Company", "duration": "Duration", "description": "Description"}],
  "education": [{"degree": "Degree", "institution": "Institution", "year": "Year"}],
  "keywords": ["keyword1", "keyword2"]
}
Return ONLY the JSON, no other text.""",
                file_contents=[file_attachment]
            )
            
            response = await chat.send_message(message)
            
            # Parse JSON from response
            import json
            response_text = response.strip()
            if response_text.startswith('```json'):
                response_text = response_text[7:-3].strip()
            elif response_text.startswith('```'):
                response_text = response_text[3:-3].strip()
            
            parsed_data = json.loads(response_text)
            return parsed_data
        finally:
            # Clean up temp file
            os.unlink(tmp_path)
            
    except Exception as e:
        logging.error(f"Error parsing resume: {e}")
        return {"error": str(e), "raw_text": "Could not parse resume"}

async def generate_tailored_resume(resume_data: dict, job_description: str, job_requirements: str) -> str:
    """Generate tailored resume content"""
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"resume-gen-{uuid.uuid4()}",
            system_message="You are an expert resume writer who creates ATS-optimized, tailored resumes."
        ).with_model("openai", "gpt-4o")
        
        message = UserMessage(
            text=f"""Based on the candidate's resume data and the job requirements, create a tailored resume that highlights relevant skills and experience.

Candidate Resume Data:
{resume_data}

Job Description:
{job_description}

Job Requirements:
{job_requirements}

Generate a professional, ATS-optimized resume in plain text format. Focus on matching keywords and highlighting relevant experience."""
        )
        
        response = await chat.send_message(message)
        return response
    except Exception as e:
        logging.error(f"Error generating tailored resume: {e}")
        return f"Error generating resume: {str(e)}"

async def generate_cover_letter(resume_data: dict, job_title: str, company: str, job_description: str) -> str:
    """Generate tailored cover letter"""
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"cover-letter-{uuid.uuid4()}",
            system_message="You are an expert cover letter writer who creates compelling, personalized cover letters."
        ).with_model("openai", "gpt-4o")
        
        message = UserMessage(
            text=f"""Write a professional cover letter for the following:

Candidate Name: {resume_data.get('name', 'Candidate')}
Job Title: {job_title}
Company: {company}
Job Description: {job_description}

Candidate Background:
{resume_data}

Create a compelling cover letter that showcases why the candidate is a great fit for this role."""
        )
        
        response = await chat.send_message(message)
        return response
    except Exception as e:
        logging.error(f"Error generating cover letter: {e}")
        return f"Error generating cover letter: {str(e)}"

# ============ Routes ============

@api_router.get("/")
async def root():
    return {"message": "AI Job Application Agent API"}

# Auth Routes
@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserRegister):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user = User(
        email=user_data.email,
        full_name=user_data.full_name
    )
    
    user_dict = user.model_dump()
    user_dict['created_at'] = user_dict['created_at'].isoformat()
    user_dict['password_hash'] = hash_password(user_data.password)
    
    await db.users.insert_one(user_dict)
    
    # Create token
    token = create_access_token(user.id, user.email)
    
    return TokenResponse(access_token=token, user=user)

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(credentials.password, user['password_hash']):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_access_token(user['id'], user['email'])
    
    user_obj = User(**user)
    return TokenResponse(access_token=token, user=user_obj)

# Resume Routes
@api_router.post("/resume/upload")
async def upload_resume(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    if not file.filename.endswith(('.pdf', '.txt', '.doc', '.docx')):
        raise HTTPException(status_code=400, detail="Invalid file format. Only PDF, TXT, DOC, DOCX allowed")
    
    # Read file
    content = await file.read()
    
    # Parse resume with AI
    parsed_data = await parse_resume_with_ai(content, file.filename)
    
    # Save to database
    resume = ResumeData(
        user_id=current_user['id'],
        file_name=file.filename,
        parsed_data=parsed_data
    )
    
    resume_dict = resume.model_dump()
    resume_dict['uploaded_at'] = resume_dict['uploaded_at'].isoformat()
    
    await db.resumes.insert_one(resume_dict)
    
    return {"message": "Resume uploaded and parsed successfully", "resume_id": resume.id, "parsed_data": parsed_data}

@api_router.get("/resume")
async def get_resume(current_user: dict = Depends(get_current_user)):
    resume = await db.resumes.find_one({"user_id": current_user['id']}, {"_id": 0}, sort=[("uploaded_at", -1)])
    if not resume:
        return None
    return resume

# Job Routes
@api_router.post("/jobs", response_model=Job)
async def create_job(
    job_data: JobCreate,
    current_user: dict = Depends(get_current_user)
):
    job = Job(
        user_id=current_user['id'],
        **job_data.model_dump()
    )
    
    job_dict = job.model_dump()
    job_dict['added_at'] = job_dict['added_at'].isoformat()
    
    await db.jobs.insert_one(job_dict)
    
    return job

@api_router.get("/jobs", response_model=List[Job])
async def get_jobs(current_user: dict = Depends(get_current_user)):
    jobs = await db.jobs.find({"user_id": current_user['id']}, {"_id": 0}).sort("added_at", -1).to_list(1000)
    
    for job in jobs:
        if isinstance(job.get('added_at'), str):
            job['added_at'] = datetime.fromisoformat(job['added_at'])
    
    return jobs

@api_router.delete("/jobs/{job_id}")
async def delete_job(
    job_id: str,
    current_user: dict = Depends(get_current_user)
):
    result = await db.jobs.delete_one({"id": job_id, "user_id": current_user['id']})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"message": "Job deleted successfully"}

# Application Routes
@api_router.post("/applications/{job_id}")
async def apply_to_job(
    job_id: str,
    current_user: dict = Depends(get_current_user)
):
    # Get job
    job = await db.jobs.find_one({"id": job_id, "user_id": current_user['id']}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Get resume
    resume = await db.resumes.find_one({"user_id": current_user['id']}, {"_id": 0}, sort=[("uploaded_at", -1)])
    if not resume:
        raise HTTPException(status_code=400, detail="Please upload a resume first")
    
    # Check if already applied
    existing = await db.applications.find_one({"user_id": current_user['id'], "job_id": job_id}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Already applied to this job")
    
    # Generate tailored resume and cover letter
    tailored_resume = await generate_tailored_resume(
        resume['parsed_data'],
        job['description'],
        job['requirements']
    )
    
    cover_letter = await generate_cover_letter(
        resume['parsed_data'],
        job['title'],
        job['company'],
        job['description']
    )
    
    # Create application
    application = Application(
        user_id=current_user['id'],
        job_id=job_id,
        job_title=job['title'],
        company=job['company'],
        status='applied',
        tailored_resume=tailored_resume,
        cover_letter=cover_letter
    )
    
    app_dict = application.model_dump()
    app_dict['applied_at'] = app_dict['applied_at'].isoformat()
    app_dict['updated_at'] = app_dict['updated_at'].isoformat()
    
    await db.applications.insert_one(app_dict)
    
    return {"message": "Application created successfully", "application": application}

@api_router.get("/applications", response_model=List[Application])
async def get_applications(current_user: dict = Depends(get_current_user)):
    applications = await db.applications.find(
        {"user_id": current_user['id']},
        {"_id": 0}
    ).sort("applied_at", -1).to_list(1000)
    
    for app in applications:
        if isinstance(app.get('applied_at'), str):
            app['applied_at'] = datetime.fromisoformat(app['applied_at'])
        if isinstance(app.get('updated_at'), str):
            app['updated_at'] = datetime.fromisoformat(app['updated_at'])
    
    return applications

@api_router.get("/applications/{application_id}", response_model=Application)
async def get_application(
    application_id: str,
    current_user: dict = Depends(get_current_user)
):
    application = await db.applications.find_one(
        {"id": application_id, "user_id": current_user['id']},
        {"_id": 0}
    )
    
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    
    if isinstance(application.get('applied_at'), str):
        application['applied_at'] = datetime.fromisoformat(application['applied_at'])
    if isinstance(application.get('updated_at'), str):
        application['updated_at'] = datetime.fromisoformat(application['updated_at'])
    
    return application

@api_router.patch("/applications/{application_id}/status")
async def update_application_status(
    application_id: str,
    status_update: ApplicationStatusUpdate,
    current_user: dict = Depends(get_current_user)
):
    result = await db.applications.update_one(
        {"id": application_id, "user_id": current_user['id']},
        {"$set": {"status": status_update.status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Application not found")
    
    return {"message": "Status updated successfully"}

@api_router.get("/stats")
async def get_stats(current_user: dict = Depends(get_current_user)):
    total_jobs = await db.jobs.count_documents({"user_id": current_user['id']})
    total_applications = await db.applications.count_documents({"user_id": current_user['id']})
    
    # Count by status
    pipeline = [
        {"$match": {"user_id": current_user['id']}},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    
    status_counts = {}
    async for doc in db.applications.aggregate(pipeline):
        status_counts[doc['_id']] = doc['count']
    
    return {
        "total_jobs": total_jobs,
        "total_applications": total_applications,
        "by_status": status_counts
    }

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()