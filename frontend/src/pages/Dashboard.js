import { useState, useEffect, useContext } from 'react';
import { AuthContext, API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import axios from 'axios';
import { toast } from 'sonner';
import { Upload, FileText, Briefcase, TrendingUp, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [resume, setResume] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [recentApplications, setRecentApplications] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const [statsRes, resumeRes, appsRes] = await Promise.all([
        axios.get(`${API}/stats`, { headers }),
        axios.get(`${API}/resume`, { headers }),
        axios.get(`${API}/applications`, { headers })
      ]);

      setStats(statsRes.data);
      setResume(resumeRes.data);
      setRecentApplications(appsRes.data.slice(0, 5));
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = localStorage.getItem('token');
      await axios.post(`${API}/resume/upload`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      toast.success('Resume uploaded and parsed successfully!');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const statusColors = {
    applied: 'bg-blue-500',
    interview: 'bg-purple-500',
    rejected: 'bg-red-500',
    accepted: 'bg-green-500',
    pending: 'bg-yellow-500'
  };

  const statusIcons = {
    applied: <Clock className="w-4 h-4" />,
    interview: <TrendingUp className="w-4 h-4" />,
    rejected: <XCircle className="w-4 h-4" />,
    accepted: <CheckCircle2 className="w-4 h-4" />,
    pending: <Clock className="w-4 h-4" />
  };

  return (
    <Layout>
      <div className="space-y-8" data-testid="dashboard">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Welcome back, {user?.full_name}!</h1>
          <p className="text-lg text-gray-600">Track your job applications and manage your career journey</p>
        </div>

        {/* Resume Upload Card */}
        {!resume && (
          <Card className="border-2 border-dashed border-indigo-300 bg-gradient-to-br from-indigo-50 to-blue-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Upload Your Resume
              </CardTitle>
              <CardDescription>Start by uploading your resume. AI will parse and extract key information.</CardDescription>
            </CardHeader>
            <CardContent>
              <label htmlFor="resume-upload">
                <Button
                  data-testid="upload-resume-button"
                  className="bg-indigo-600 hover:bg-indigo-700"
                  disabled={uploading}
                  onClick={() => document.getElementById('resume-upload').click()}
                >
                  {uploading ? 'Uploading...' : 'Choose File'}
                </Button>
              </label>
              <input
                id="resume-upload"
                type="file"
                accept=".pdf,.txt,.doc,.docx"
                onChange={handleFileUpload}
                className="hidden"
              />
            </CardContent>
          </Card>
        )}

        {/* Stats Grid */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0 shadow-lg hover:shadow-xl">
              <CardHeader className="pb-3">
                <CardDescription className="text-blue-100">Total Jobs</CardDescription>
                <CardTitle className="text-4xl font-bold" data-testid="stat-total-jobs">{stats.total_jobs}</CardTitle>
              </CardHeader>
              <CardContent>
                <Briefcase className="w-8 h-8 opacity-50" />
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0 shadow-lg hover:shadow-xl">
              <CardHeader className="pb-3">
                <CardDescription className="text-purple-100">Applications</CardDescription>
                <CardTitle className="text-4xl font-bold" data-testid="stat-applications">{stats.total_applications}</CardTitle>
              </CardHeader>
              <CardContent>
                <FileText className="w-8 h-8 opacity-50" />
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-0 shadow-lg hover:shadow-xl">
              <CardHeader className="pb-3">
                <CardDescription className="text-green-100">Accepted</CardDescription>
                <CardTitle className="text-4xl font-bold" data-testid="stat-accepted">{stats.by_status?.accepted || 0}</CardTitle>
              </CardHeader>
              <CardContent>
                <CheckCircle2 className="w-8 h-8 opacity-50" />
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white border-0 shadow-lg hover:shadow-xl">
              <CardHeader className="pb-3">
                <CardDescription className="text-orange-100">In Progress</CardDescription>
                <CardTitle className="text-4xl font-bold" data-testid="stat-in-progress">
                  {(stats.by_status?.applied || 0) + (stats.by_status?.interview || 0)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <TrendingUp className="w-8 h-8 opacity-50" />
              </CardContent>
            </Card>
          </div>
        )}

        {/* Resume Info */}
        {resume && (
          <Card className="shadow-lg border-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-indigo-600" />
                    Your Resume
                  </CardTitle>
                  <CardDescription>Uploaded: {new Date(resume.uploaded_at).toLocaleDateString()}</CardDescription>
                </div>
                <label htmlFor="resume-reupload">
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid="reupload-resume-button"
                    disabled={uploading}
                    onClick={() => document.getElementById('resume-reupload').click()}
                  >
                    {uploading ? 'Uploading...' : 'Update Resume'}
                  </Button>
                </label>
                <input
                  id="resume-reupload"
                  type="file"
                  accept=".pdf,.txt,.doc,.docx"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Name</p>
                  <p className="font-medium" data-testid="resume-name">{resume.parsed_data?.name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Email</p>
                  <p className="font-medium" data-testid="resume-email">{resume.parsed_data?.email || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Skills</p>
                  <p className="font-medium" data-testid="resume-skills">
                    {resume.parsed_data?.skills?.slice(0, 3).join(', ') || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">File</p>
                  <p className="font-medium text-sm truncate" data-testid="resume-filename">{resume.file_name}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Applications */}
        {recentApplications.length > 0 && (
          <Card className="shadow-lg border-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Recent Applications</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  data-testid="view-all-applications-button"
                  onClick={() => navigate('/applications')}
                >
                  View All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentApplications.map((app) => (
                  <div
                    key={app.id}
                    data-testid={`recent-application-${app.id}`}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer"
                    onClick={() => navigate(`/applications/${app.id}`)}
                  >
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">{app.job_title}</h4>
                      <p className="text-sm text-gray-600">{app.company}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500">
                        {new Date(app.applied_at).toLocaleDateString()}
                      </span>
                      <div className={`flex items-center gap-1 px-3 py-1 rounded-full ${statusColors[app.status]} bg-opacity-10`}>
                        <span className={statusColors[app.status].replace('bg-', 'text-')}>
                          {statusIcons[app.status]}
                        </span>
                        <span className={`text-xs font-medium ${statusColors[app.status].replace('bg-', 'text-')}`}>
                          {app.status}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-2 hover:shadow-lg cursor-pointer" onClick={() => navigate('/jobs')}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-indigo-600" />
                Add New Job
              </CardTitle>
              <CardDescription>Find and add jobs you want to apply to</CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2 hover:shadow-lg cursor-pointer" onClick={() => navigate('/applications')}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-purple-600" />
                View Applications
              </CardTitle>
              <CardDescription>Track all your job applications</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    </Layout>
  );
}