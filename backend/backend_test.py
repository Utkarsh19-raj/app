import requests
import sys
import json
import tempfile
import os
from datetime import datetime

class JobApplicationAPITester:
    def __init__(self, base_url="https://hireme-autopilot.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
        
        result = {
            "test": name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {name}")
        if details:
            print(f"    Details: {details}")

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                if files:
                    # Remove Content-Type for file uploads
                    headers.pop('Content-Type', None)
                    response = requests.post(url, files=files, headers=headers)
                else:
                    response = requests.post(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=headers)

            success = response.status_code == expected_status
            details = f"Status: {response.status_code}"
            
            if not success:
                details += f" (Expected: {expected_status})"
                try:
                    error_data = response.json()
                    details += f", Error: {error_data.get('detail', 'Unknown error')}"
                except:
                    details += f", Response: {response.text[:100]}"

            self.log_test(name, success, details)
            
            if success:
                try:
                    return response.json()
                except:
                    return {}
            return None

        except Exception as e:
            self.log_test(name, False, f"Exception: {str(e)}")
            return None

    def test_root_endpoint(self):
        """Test root API endpoint"""
        result = self.run_test("Root Endpoint", "GET", "", 200)
        return result is not None

    def test_user_registration(self):
        """Test user registration"""
        timestamp = datetime.now().strftime('%H%M%S')
        user_data = {
            "email": f"test_user_{timestamp}@example.com",
            "password": "TestPass123!",
            "full_name": f"Test User {timestamp}"
        }
        
        result = self.run_test("User Registration", "POST", "auth/register", 200, user_data)
        if result and 'access_token' in result:
            self.token = result['access_token']
            self.user_id = result['user']['id']
            return True
        return False

    def test_user_login(self):
        """Test user login with existing credentials"""
        if not self.token:
            return False
            
        # Create a new user for login test
        timestamp = datetime.now().strftime('%H%M%S') + "login"
        register_data = {
            "email": f"login_test_{timestamp}@example.com",
            "password": "LoginTest123!",
            "full_name": f"Login Test {timestamp}"
        }
        
        # Register first
        register_result = self.run_test("Register for Login Test", "POST", "auth/register", 200, register_data)
        if not register_result:
            return False
            
        # Now test login
        login_data = {
            "email": register_data["email"],
            "password": register_data["password"]
        }
        
        result = self.run_test("User Login", "POST", "auth/login", 200, login_data)
        return result is not None and 'access_token' in result

    def test_resume_upload(self):
        """Test resume upload and parsing"""
        if not self.token:
            return False

        # Create a test resume file
        resume_content = """John Doe
Email: john.doe@example.com
Phone: (555) 123-4567

PROFESSIONAL SUMMARY
Experienced software engineer with 5+ years in full-stack development.

SKILLS
- Python, JavaScript, React, Node.js
- AWS, Docker, Kubernetes
- MongoDB, PostgreSQL

EXPERIENCE
Senior Software Engineer | Tech Corp | 2020-2024
- Developed scalable web applications
- Led team of 3 developers
- Implemented CI/CD pipelines

Software Engineer | StartupXYZ | 2018-2020
- Built REST APIs using Python/Flask
- Designed database schemas
- Collaborated with cross-functional teams

EDUCATION
Bachelor of Science in Computer Science | University ABC | 2018
"""

        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write(resume_content)
            temp_path = f.name

        try:
            with open(temp_path, 'rb') as f:
                files = {'file': ('test_resume.txt', f, 'text/plain')}
                result = self.run_test("Resume Upload", "POST", "resume/upload", 200, files=files)
                
            return result is not None and 'parsed_data' in result
        finally:
            os.unlink(temp_path)

    def test_get_resume(self):
        """Test getting user's resume"""
        if not self.token:
            return False
            
        result = self.run_test("Get Resume", "GET", "resume", 200)
        return result is not None

    def test_create_job(self):
        """Test creating a job"""
        if not self.token:
            return False

        job_data = {
            "title": "Senior Python Developer",
            "company": "TechCorp Inc",
            "description": "We are looking for a senior Python developer to join our team. You will be responsible for developing scalable web applications using Python, Django, and React.",
            "requirements": "5+ years Python experience, Django, React, AWS, strong problem-solving skills",
            "location": "San Francisco, CA (Remote)",
            "url": "https://example.com/jobs/senior-python-dev"
        }
        
        result = self.run_test("Create Job", "POST", "jobs", 200, job_data)
        if result and 'id' in result:
            self.job_id = result['id']
            return True
        return False

    def test_get_jobs(self):
        """Test getting user's jobs"""
        if not self.token:
            return False
            
        result = self.run_test("Get Jobs", "GET", "jobs", 200)
        return result is not None and isinstance(result, list)

    def test_apply_to_job(self):
        """Test applying to a job (AI generation)"""
        if not self.token or not hasattr(self, 'job_id'):
            return False

        result = self.run_test("Apply to Job", "POST", f"applications/{self.job_id}", 200)
        if result and 'application' in result:
            self.application_id = result['application']['id']
            return True
        return False

    def test_get_applications(self):
        """Test getting user's applications"""
        if not self.token:
            return False
            
        result = self.run_test("Get Applications", "GET", "applications", 200)
        return result is not None and isinstance(result, list)

    def test_get_application_detail(self):
        """Test getting specific application details"""
        if not self.token or not hasattr(self, 'application_id'):
            return False
            
        result = self.run_test("Get Application Detail", "GET", f"applications/{self.application_id}", 200)
        return result is not None and 'tailored_resume' in result and 'cover_letter' in result

    def test_update_application_status(self):
        """Test updating application status"""
        if not self.token or not hasattr(self, 'application_id'):
            return False

        status_data = {"status": "interview"}
        result = self.run_test("Update Application Status", "PATCH", f"applications/{self.application_id}/status", 200, status_data)
        return result is not None

    def test_get_stats(self):
        """Test getting dashboard stats"""
        if not self.token:
            return False
            
        result = self.run_test("Get Stats", "GET", "stats", 200)
        return result is not None and 'total_jobs' in result and 'total_applications' in result

    def test_delete_job(self):
        """Test deleting a job"""
        if not self.token or not hasattr(self, 'job_id'):
            return False
            
        result = self.run_test("Delete Job", "DELETE", f"jobs/{self.job_id}", 200)
        return result is not None

    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting AI Job Application API Tests")
        print("=" * 50)

        # Test sequence
        tests = [
            self.test_root_endpoint,
            self.test_user_registration,
            self.test_user_login,
            self.test_resume_upload,
            self.test_get_resume,
            self.test_create_job,
            self.test_get_jobs,
            self.test_apply_to_job,
            self.test_get_applications,
            self.test_get_application_detail,
            self.test_update_application_status,
            self.test_get_stats,
            self.test_delete_job
        ]

        for test in tests:
            try:
                test()
            except Exception as e:
                self.log_test(test.__name__, False, f"Exception: {str(e)}")

        # Print summary
        print("\n" + "=" * 50)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return 0
        else:
            print("❌ Some tests failed. Check details above.")
            return 1

def main():
    tester = JobApplicationAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())