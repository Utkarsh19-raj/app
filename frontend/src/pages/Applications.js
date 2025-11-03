import { useState, useEffect } from 'react';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import axios from 'axios';
import { toast } from 'sonner';
import { FileText, Clock, TrendingUp, CheckCircle2, XCircle, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Applications() {
  const navigate = useNavigate();
  const [applications, setApplications] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/applications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setApplications(response.data);
    } catch (error) {
      toast.error('Failed to fetch applications');
    }
  };

  const handleStatusUpdate = async (appId, newStatus) => {
    try {
      const token = localStorage.getItem('token');
      await axios.patch(
        `${API}/applications/${appId}/status`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Status updated');
      fetchApplications();
    } catch (error) {
      toast.error('Failed to update status');
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

  const filteredApplications = filter === 'all' 
    ? applications 
    : applications.filter(app => app.status === filter);

  return (
    <Layout>
      <div className="space-y-6" data-testid="applications-page">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">My Applications</h1>
            <p className="text-lg text-gray-600">Track and manage your job applications</p>
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-48" data-testid="status-filter">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Applications</SelectItem>
              <SelectItem value="applied">Applied</SelectItem>
              <SelectItem value="interview">Interview</SelectItem>
              <SelectItem value="accepted">Accepted</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Applications List */}
        {filteredApplications.length === 0 ? (
          <Card className="border-2 border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="w-16 h-16 text-gray-300 mb-4" />
              <h3 className="text-xl font-semibold text-gray-600 mb-2">No applications yet</h3>
              <p className="text-gray-500 mb-4">Start by adding jobs and applying to them</p>
              <Button
                onClick={() => navigate('/jobs')}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                Browse Jobs
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredApplications.map((app) => (
              <Card key={app.id} data-testid={`application-card-${app.id}`} className="border-2 hover:shadow-lg">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-2xl mb-1">{app.job_title}</CardTitle>
                      <CardDescription className="text-base">{app.company}</CardDescription>
                    </div>
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${statusColors[app.status]} bg-opacity-10`}>
                      <span className={statusColors[app.status].replace('bg-', 'text-')}>
                        {statusIcons[app.status]}
                      </span>
                      <span className={`font-medium ${statusColors[app.status].replace('bg-', 'text-')}`}>
                        {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-500">
                      Applied: {new Date(app.applied_at).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </div>
                    <div className="flex items-center gap-2">
                      <Select
                        value={app.status}
                        onValueChange={(value) => handleStatusUpdate(app.id, value)}
                      >
                        <SelectTrigger className="w-40" data-testid={`status-select-${app.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="applied">Applied</SelectItem>
                          <SelectItem value="interview">Interview</SelectItem>
                          <SelectItem value="accepted">Accepted</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        data-testid={`view-application-${app.id}`}
                        onClick={() => navigate(`/applications/${app.id}`)}
                        className="bg-indigo-600 hover:bg-indigo-700"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View Details
                      </Button>
                    </div>
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