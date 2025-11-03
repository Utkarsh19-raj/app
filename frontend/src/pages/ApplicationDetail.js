import { useState, useEffect } from 'react';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import axios from 'axios';
import { toast } from 'sonner';
import { ArrowLeft, FileText, Mail, Copy, Check } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

export default function ApplicationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [application, setApplication] = useState(null);
  const [copied, setCopied] = useState({ resume: false, cover: false });

  useEffect(() => {
    fetchApplication();
  }, [id]);

  const fetchApplication = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/applications/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setApplication(response.data);
    } catch (error) {
      toast.error('Failed to fetch application details');
      navigate('/applications');
    }
  };

  const copyToClipboard = async (text, type) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied({ ...copied, [type]: true });
      toast.success('Copied to clipboard!');
      setTimeout(() => {
        setCopied({ ...copied, [type]: false });
      }, 2000);
    } catch (error) {
      toast.error('Failed to copy');
    }
  };

  if (!application) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-xl text-gray-600">Loading...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6" data-testid="application-detail">
        {/* Back Button */}
        <Button
          variant="ghost"
          data-testid="back-button"
          onClick={() => navigate('/applications')}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Applications
        </Button>

        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2" data-testid="job-title">{application.job_title}</h1>
          <p className="text-xl text-gray-600" data-testid="company-name">{application.company}</p>
          <p className="text-sm text-gray-500 mt-2">
            Applied on {new Date(application.applied_at).toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
        </div>

        {/* Status Card */}
        <Card className="border-2 bg-gradient-to-br from-indigo-50 to-purple-50">
          <CardHeader>
            <CardTitle>Application Status</CardTitle>
            <CardDescription>
              <span className="inline-block px-4 py-2 rounded-full bg-indigo-600 text-white font-medium text-lg mt-2" data-testid="status-badge">
                {application.status.charAt(0).toUpperCase() + application.status.slice(1)}
              </span>
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Documents */}
        <Tabs defaultValue="resume" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="resume" data-testid="resume-tab">
              <FileText className="w-4 h-4 mr-2" />
              Tailored Resume
            </TabsTrigger>
            <TabsTrigger value="cover" data-testid="cover-letter-tab">
              <Mail className="w-4 h-4 mr-2" />
              Cover Letter
            </TabsTrigger>
          </TabsList>

          <TabsContent value="resume">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Tailored Resume</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid="copy-resume-button"
                    onClick={() => copyToClipboard(application.tailored_resume, 'resume')}
                  >
                    {copied.resume ? (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-2" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-50 p-6 rounded-lg border-2" data-testid="resume-content">
                  <pre className="whitespace-pre-wrap font-sans text-sm text-gray-800">
                    {application.tailored_resume}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cover">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Cover Letter</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid="copy-cover-letter-button"
                    onClick={() => copyToClipboard(application.cover_letter, 'cover')}
                  >
                    {copied.cover ? (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-2" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-50 p-6 rounded-lg border-2" data-testid="cover-letter-content">
                  <pre className="whitespace-pre-wrap font-sans text-sm text-gray-800">
                    {application.cover_letter}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}