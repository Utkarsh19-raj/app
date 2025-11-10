from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from google import generativeai as genai
from PyPDF2 import PdfReader
import uuid
import os
from dotenv import load_dotenv
import json

# ==== LOAD .env ====
load_dotenv()

# ==== APP SETUP ====
app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

# ==== DATABASE SETUP ====
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# ==== GOOGLE GEMINI SETUP ====
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

# ==== USER MODEL ====
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)

# ==== RESUME MODEL ====
class Resume(db.Model):
    id = db.Column(db.String, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    file_path = db.Column(db.String, nullable=False)
    parsed_data = db.Column(db.Text)  # JSON string

with app.app_context():
    db.create_all()

# ==== REGISTER ====
@app.route('/api/resume/upload', methods=['POST'])
def register_resume():
    try:
        if 'file' not in request.files:
            return jsonify({"error": "No file uploaded. Use 'file' key."}), 400

        file = request.files['file']

        if file.filename == '':
            return jsonify({"error": "Filename is empty"}), 400

        os.makedirs("uploads", exist_ok=True)
        filename = secure_filename(file.filename)
        unique_name = f"{uuid.uuid4()}_{filename}"
        filepath = os.path.join("uploads", unique_name)
        file.save(filepath)

        extracted_text = ""
        if filename.lower().endswith(".pdf"):
            reader = PdfReader(filepath)
            for page in reader.pages:
                extracted_text += page.extract_text() or ""
        else:
            extracted_text = file.read().decode("utf-8", errors="ignore")

        if not extracted_text.strip():
            return jsonify({"error": "Couldn't extract text from file"}), 400

        model = genai.GenerativeModel("gemini-1.5-flash")
        response = model.generate_content(
            f"Extract JSON with name, email, phone, skills(list), experience(list of roles), education(list) from this resume:\n\n{extracted_text}"
        )

        return jsonify({
            "message": "Uploaded Successfully",
            "parsed_data": response.text
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ==== LOGIN ====
@app.route('/api/login', methods=['POST'])
def login_user():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    user = User.query.filter_by(email=email).first()

    if user and check_password_hash(user.password, password):
        return jsonify({'status': 'success', 'message': 'Login successful', 'user_id': user.id})
    else:
        return jsonify({'status': 'error', 'message': 'Invalid email or password'}), 401

# ==== RESUME UPLOAD ====
# server.py  (replace the two upload routes with ONE clean route)

@app.route('/api/resume/upload', methods=['POST'])
def upload_resume():
    # -------------------------------------------------
    # 1. Auth – get the JWT from Authorization header
    # -------------------------------------------------
    auth = request.headers.get('Authorization')
    if not auth or not auth.startswith('Bearer '):
        return jsonify({'detail': 'Missing or invalid token'}), 401
    token = auth.split(' ')[1]

    # TODO: verify token → get user_id (you already have login, just add JWT lib)
    # For now we keep the hard-coded user_id = 1 (replace later)
    user_id = 1

    # -------------------------------------------------
    # 2. File validation
    # -------------------------------------------------
    if 'file' not in request.files:
        return jsonify({'detail': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'detail': 'No selected file'}), 400

    # -------------------------------------------------
    # 3. Save file safely
    # -------------------------------------------------
    os.makedirs("uploads", exist_ok=True)
    filename = secure_filename(file.filename)
    file_id = str(uuid.uuid4())
    filepath = os.path.join("uploads", f"{file_id}_{filename}")
    file.save(filepath)

    # -------------------------------------------------
    # 4. Extract raw text
    # -------------------------------------------------
    extracted_text = ""
    if filename.lower().endswith('.pdf'):
        try:
            reader = PdfReader(filepath)
            for page in reader.pages:
                extracted_text += page.extract_text() or ""
        except Exception as e:
            return jsonify({'detail': f'PDF read error: {e}'}), 400
    else:
        # .docx, .txt, .doc
        extracted_text = file.read().decode('utf-8', errors='ignore')

    if not extracted_text.strip():
        return jsonify({'detail': 'Empty document'}), 400

    # -------------------------------------------------
    # 5. Gemini parsing (force JSON)
    # -------------------------------------------------
    model = genai.GenerativeModel("gemini-1.5-flash")
    prompt = (
        "Extract the following fields from the resume and return **only** a valid JSON object. "
        "Do NOT add any extra text, markdown, or code fences.\n\n"
        "Fields:\n"
        "- name (string)\n"
        "- email (string)\n"
        "- phone (string)\n"
        "- summary (string, optional)\n"
        "- skills (list of strings)\n"
        "- experience (list of objects: title, company, duration, description)\n"
        "- education (list of objects: degree, institution, year)\n\n"
        f"Resume text:\n{extracted_text}"
    )
    try:
        ai_resp = model.generate_content(prompt)
        raw = ai_resp.text.strip()
        # Gemini sometimes wraps in ```json ... ``` – strip it
        if raw.startswith('```'):
            raw = raw.split('\n', 1)[1].rsplit('```', 1)[0].strip()
        parsed_json = json.loads(raw)
    except Exception as e:
        return jsonify({'detail': f'AI parsing failed: {e}'}), 500

    # -------------------------------------------------
    # 6. Save to DB
    # -------------------------------------------------
    resume = Resume(
        id=file_id,
        user_id=user_id,
        file_path=filepath,
        parsed_data=json.dumps(parsed_json)
    )
    db.session.add(resume)
    db.session.commit()

    return jsonify({
        'message': 'Resume uploaded & parsed',
        'parsed_data': parsed_json
    }), 200