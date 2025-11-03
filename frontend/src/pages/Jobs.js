import { useState, useEffect } from 'react';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import axios from 'axios';
import { toast } from 'sonner';
import { Plus, Briefcase, MapPin, ExternalLink, Trash2, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Jobs() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [applying, setApplying] = useState(null);
  
  const [formData, setFormData] = useState({
    title: '',
    company: '',
    description: '',
    requirements: '',
    location: '',
    url: ''
  });

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/jobs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setJobs(response.data);
    } catch (error) {
      toast.error('Failed to fetch jobs');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/jobs`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Job added successfully!');
      setDialogOpen(false);
      setFormData({ title: '', company: '', description: '', requirements: '', location: '', url: '' });
      fetchJobs();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add job');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (jobId) => {
    if (!window.confirm('Are you sure you want to delete this job?')) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/jobs/${jobId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Job deleted');
      fetchJobs();
    } catch (error) {
      toast.error('Failed to delete job');
    }
  };

  const handleApply = async (jobId) => {
    setApplying(jobId);
    toast.loading('Generating tailored resume and cover letter with AI...', { id: 'applying' });
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/applications/${jobId}`, {}, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 120000 // 2 minute timeout for AI generation
      });
      toast.success('Application created! Tailored resume and cover letter generated.', { id: 'applying' });
      navigate('/applications');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to apply', { id: 'applying' });
    } finally {
      setApplying(null);
    }
  };

  return (
    <Layout>
      <div className="space-y-6" data-testid="jobs-page">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Job Opportunities</h1>
            <p className="text-lg text-gray-600">Add jobs and let AI create tailored applications</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="add-job-button" className="bg-indigo-600 hover:bg-indigo-700">
                <Plus className="w-4 h-4 mr-2" />
                Add Job
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Job</DialogTitle>
                <DialogDescription>Enter the job details manually</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Job Title *</Label>
                  <Input
                    id="title"
                    data-testid="job-title-input"
                    placeholder="e.g., Senior Software Engineer"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company">Company *</Label>
                  <Input
                    id="company"
                    data-testid="job-company-input"
                    placeholder="e.g., Google"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    data-testid="job-location-input"
                    placeholder="e.g., San Francisco, CA (Remote)"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="url">Job URL</Label>
                  <Input
                    id="url"
                    data-testid="job-url-input"
                    placeholder="https://..."
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Job Description *</Label>
                  <Textarea
                    id="description"
                    data-testid="job-description-input"
                    placeholder="Paste the job description here..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={6}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="requirements">Requirements *</Label>
                  <Textarea
                    id="requirements"
                    data-testid="job-requirements-input"
                    placeholder="Paste the job requirements here..."
                    value={formData.requirements}
                    onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                    rows={6}
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    data-testid="submit-job-button"
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                    disabled={loading}
                  >
                    {loading ? 'Adding...' : 'Add Job'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Jobs Grid */}
        {jobs.length === 0 ? (
          <Card className="border-2 border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Briefcase className="w-16 h-16 text-gray-300 mb-4" />
              <h3 className="text-xl font-semibold text-gray-600 mb-2">No jobs yet</h3>
              <p className="text-gray-500 mb-4">Add your first job to start applying</p>
              <Button
                data-testid="add-first-job-button"
                onClick={() => setDialogOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Job
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {jobs.map((job) => (
              <Card key={job.id} data-testid={`job-card-${job.id}`} className="border-2 hover:shadow-xl flex flex-col">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-xl mb-1">{job.title}</CardTitle>
                      <CardDescription className="text-base font-medium text-gray-700">{job.company}</CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      data-testid={`delete-job-${job.id}`}
                      onClick={() => handleDelete(job.id)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  {job.location && (
                    <div className="flex items-center gap-1 text-sm text-gray-500 mt-2">
                      <MapPin className="w-4 h-4" />
                      {job.location}
                    </div>
                  )}
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <p className="text-sm text-gray-600 line-clamp-3 mb-4">
                    {job.description}
                  </p>
                  <div className="mt-auto space-y-2">
                    <Button
                      data-testid={`apply-job-${job.id}`}
                      onClick={() => handleApply(job.id)}
                      className="w-full bg-indigo-600 hover:bg-indigo-700"
                      disabled={applying === job.id}
                    >
                      {applying === job.id ? (
                        'Applying...'
                      ) : (
                        <>
                          <Zap className="w-4 h-4 mr-2" />
                          Apply with AI
                        </>
                      )}
                    </Button>
                    {job.url && (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => window.open(job.url, '_blank')}
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        View Job Posting
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}