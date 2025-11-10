// ResumeEditor.js
import { useState, useEffect, useRef } from 'react';
import { API } from '@/App';
import Layout from '@/components/Layout';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import axios from 'axios';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  Save,
  Eye,
  Edit,
  Plus,
  Trash2,
  ArrowLeft,
} from 'lucide-react';

export default function ResumeEditor() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const reuploadInputRef = useRef(null);

  const [resume, setResume] = useState(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [editData, setEditData] = useState({
    name: '',
    email: '',
    phone: '',
    summary: '',
    skills: [],
    experience: [],
    education: [],
    keywords: [],
  });

  // -------------------------------------------------
  // FETCH RESUME
  // -------------------------------------------------
  useEffect(() => {
    fetchResume();
  }, []);

  const fetchResume = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('Please log in to continue');
        navigate('/login');
        return;
      }

      const response = await axios.get(`${API}/api/resume`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data) {
        setResume(response.data);
        const parsed = response.data.parsed_data || {};
        setEditData({
          name: parsed.name || '',
          email: parsed.email || '',
          phone: parsed.phone || '',
          summary: parsed.summary || '',
          skills: parsed.skills || [],
          experience: parsed.experience || [],
          education: parsed.education || [],
          keywords: parsed.keywords || [],
        });
      }
    } catch (error) {
      console.error('Error fetching resume:', error);
      if (error.response?.status === 401) {
        toast.error('Session expired. Please log in again.');
        navigate('/login');
      }
    }
  };

  // -------------------------------------------------
  // FILE UPLOAD
  // -------------------------------------------------
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = [
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    if (!allowedTypes.includes(file.type)) {
      toast.error('Only PDF, DOC, DOCX, or TXT files are allowed.');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('Authentication required');
      navigate('/login');
      return;
    }

    try {
      await axios.post(`${API}/api/resume/upload`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          // DO NOT set Content-Type – let the browser add the boundary
        },
        timeout: 30000,
      });

      toast.success('Resume uploaded and parsed successfully!');
      fetchResume();
    } catch (error) {
      const msg =
        error.response?.data?.detail ||
        error.response?.data?.error ||
        error.message ||
        'Upload failed. Please try again.';
      toast.error(msg);
    } finally {
      setUploading(false);
      e.target.value = ''; // reset input
    }
  };

  // -------------------------------------------------
  // SAVE CHANGES
  // -------------------------------------------------
  const handleSave = async () => {
    if (!resume) return;

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/api/resume/${resume.id}`, editData, {
        headers: { Authorization: `Bearer ${token}` },
      });

      toast.success('Resume updated successfully!');
      setEditing(false);
      fetchResume();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save resume');
    } finally {
      setSaving(false);
    }
  };

  // -------------------------------------------------
  // SKILLS HELPERS
  // -------------------------------------------------
  const addSkill = () => {
    setEditData({ ...editData, skills: [...editData.skills, ''] });
  };

  const updateSkill = (index, value) => {
    const newSkills = [...editData.skills];
    newSkills[index] = value;
    setEditData({ ...editData, skills: newSkills });
  };

  const removeSkill = (index) => {
    setEditData({
      ...editData,
      skills: editData.skills.filter((_, i) => i !== index),
    });
  };

  // -------------------------------------------------
  // EXPERIENCE HELPERS
  // -------------------------------------------------
  const addExperience = () => {
    setEditData({
      ...editData,
      experience: [
        ...editData.experience,
        { title: '', company: '', duration: '', description: '' },
      ],
    });
  };

  const updateExperience = (index, field, value) => {
    const newExp = [...editData.experience];
    newExp[index][field] = value;
    setEditData({ ...editData, experience: newExp });
  };

  const removeExperience = (index) => {
    setEditData({
      ...editData,
      experience: editData.experience.filter((_, i) => i !== index),
    });
  };

  // -------------------------------------------------
  // EDUCATION HELPERS
  // -------------------------------------------------
  const addEducation = () => {
    setEditData({
      ...editData,
      education: [...editData.education, { degree: '', institution: '', year: '' }],
    });
  };

  const updateEducation = (index, field, value) => {
    const newEdu = [...editData.education];
    newEdu[index][field] = value;
    setEditData({ ...editData, education: newEdu });
  };

  const removeEducation = (index) => {
    setEditData({
      ...editData,
      education: editData.education.filter((_, i) => i !== index),
    });
  };

  // -------------------------------------------------
  // RENDER: NO RESUME YET
  // -------------------------------------------------
  if (!resume) {
    return (
      <Layout>
        <div className="space-y-8" data-testid="resume-editor-empty">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>

          <Card className="border-2 border-dashed border-indigo-300 bg-gradient-to-br from-indigo-50 to-blue-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Upload Your Resume
              </CardTitle>
              <CardDescription>
                Start by uploading your resume. AI will parse and extract key
                information for you to review.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                data-testid="upload-resume-button"
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Uploading...
                  </>
                ) : (
                  'Choose File'
                )}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.doc,.docx"
                onChange={handleFileUpload}
                className="hidden"
              />
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  // -------------------------------------------------
  // MAIN UI (RESUME EXISTS)
  // -------------------------------------------------
  return (
    <Layout>
      <div className="space-y-6" data-testid="resume-editor">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Button
              variant="ghost"
              onClick={() => navigate('/')}
              className="mb-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Resume Editor
            </h1>
            <p className="text-lg text-gray-600">
              Review and edit your parsed resume information
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={uploading}
              onClick={() => reuploadInputRef.current?.click()}
            >
              <Upload className="w-4 h-4 mr-2" />
              {uploading ? 'Uploading...' : 'Upload New'}
            </Button>
            <input
              ref={reuploadInputRef}
              type="file"
              accept=".pdf,.txt,.doc,.docx"
              onChange={handleFileUpload}
              className="hidden"
            />

            {!editing ? (
              <Button
                data-testid="edit-resume-button"
                onClick={() => setEditing(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit Resume
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditing(false);
                    fetchResume();
                  }}
                >
                  Cancel
                </Button>
                <Button
                  data-testid="save-resume-button"
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="preview" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="preview" data-testid="preview-tab">
              <Eye className="w-4 h-4 mr-2" />
              Preview
            </TabsTrigger>
            <TabsTrigger value="edit" data-testid="edit-tab">
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </TabsTrigger>
          </TabsList>

          {/* ---------- PREVIEW TAB ---------- */}
          <TabsContent value="preview">
            <Card>
              <CardHeader>
                <CardTitle>Resume Preview</CardTitle>
                <CardDescription>How your resume data looks</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-gradient-to-r from-indigo-50 to-blue-50 p-6 rounded-lg">
                  <h2
                    className="text-3xl font-bold text-gray-900 mb-2"
                    data-testid="preview-name"
                  >
                    {editData.name || 'No name provided'}
                  </h2>
                  <div className="flex flex-wrap gap-4 text-gray-600">
                    {editData.email && (
                      <span data-testid="preview-email">
                        Email: {editData.email}
                      </span>
                    )}
                    {editData.phone && (
                      <span data-testid="preview-phone">
                        Phone: {editData.phone}
                      </span>
                    )}
                  </div>
                </div>

                {editData.summary && (
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                      Professional Summary
                    </h3>
                    <p className="text-gray-700" data-testid="preview-summary">
                      {editData.summary}
                    </p>
                  </div>
                )}

                {editData.skills && editData.skills.length > 0 && (
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-3">
                      Skills
                    </h3>
                    <div
                      className="flex flex-wrap gap-2"
                      data-testid="preview-skills"
                    >
                      {editData.skills.map((skill, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {editData.experience && editData.experience.length > 0 && (
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-3">
                      Experience
                    </h3>
                    <div
                      className="space-y-4"
                      data-testid="preview-experience"
                    >
                      {editData.experience.map((exp, idx) => (
                        <div
                          key={idx}
                          className="border-l-4 border-indigo-500 pl-4"
                        >
                          <h4 className="font-bold text-lg text-gray-900">
                            {exp.title}
                          </h4>
                          <p className="text-gray-600 font-medium">
                            {exp.company}
                          </p>
                          {exp.duration && (
                            <p className="text-sm text-gray-500">
                              {exp.duration}
                            </p>
                          )}
                          {exp.description && (
                            <p className="text-gray-700 mt-2">
                              {exp.description}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {editData.education && editData.education.length > 0 && (
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-3">
                      Education
                    </h3>
                    <div
                      className="space-y-3"
                      data-testid="preview-education"
                    >
                      {editData.education.map((edu, idx) => (
                        <div
                          key={idx}
                          className="border-l-4 border-purple-500 pl-4"
                        >
                          <h4 className="font-bold text-gray-900">
                            {edu.degree}
                          </h4>
                          <p className="text-gray-600">{edu.institution}</p>
                          {edu.year && (
                            <p className="text-sm text-gray-500">{edu.year}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ---------- EDIT TAB ---------- */}
          <TabsContent value="edit">
            <Card>
              <CardHeader>
                <CardTitle>Edit Resume Information</CardTitle>
                <CardDescription>
                  Update your parsed resume data
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Personal Info */}
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-gray-900">
                    Personal Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name</Label>
                      <Input
                        id="name"
                        data-testid="edit-name"
                        value={editData.name}
                        onChange={(e) =>
                          setEditData({ ...editData, name: e.target.value })
                        }
                        disabled={!editing}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        data-testid="edit-email"
                        type="email"
                        value={editData.email}
                        onChange={(e) =>
                          setEditData({ ...editData, email: e.target.value })
                        }
                        disabled={!editing}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        data-testid="edit-phone"
                        value={editData.phone}
                        onChange={(e) =>
                          setEditData({ ...editData, phone: e.target.value })
                        }
                        disabled={!editing}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="summary">Professional Summary</Label>
                    <Textarea
                      id="summary"
                      data-testid="edit-summary"
                      value={editData.summary}
                      onChange={(e) =>
                        setEditData({ ...editData, summary: e.target.value })
                      }
                      rows={4}
                      disabled={!editing}
                    />
                  </div>
                </div>

                {/* Skills */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-gray-900">
                      Skills
                    </h3>
                    {editing && (
                      <Button
                        size="sm"
                        onClick={addSkill}
                        variant="outline"
                        data-testid="add-skill-button"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add Skill
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {editData.skills.map((skill, idx) => (
                      <div key={idx} className="flex gap-2">
                        <Input
                          data-testid={`skill-input-${idx}`}
                          value={skill}
                          onChange={(e) => updateSkill(idx, e.target.value)}
                          disabled={!editing}
                          placeholder="e.g., Python, React, AWS"
                        />
                        {editing && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => removeSkill(idx)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Experience */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-gray-900">
                      Experience
                    </h3>
                    {editing && (
                      <Button
                        size="sm"
                        onClick={addExperience}
                        variant="outline"
                        data-testid="add-experience-button"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add Experience
                      </Button>
                    )}
                  </div>
                  <div className="space-y-6">
                    {editData.experience.map((exp, idx) => (
                      <Card key={idx} className="border-2">
                        <CardContent className="pt-6 space-y-3">
                          <div className="flex justify-between items-start">
                            <h4 className="font-semibold">
                              Experience {idx + 1}
                            </h4>
                            {editing && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => removeExperience(idx)}
                                className="text-red-500 hover:text-red-700"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <Input
                              data-testid={`exp-title-${idx}`}
                              placeholder="Job Title"
                              value={exp.title}
                              onChange={(e) =>
                                updateExperience(idx, 'title', e.target.value)
                              }
                              disabled={!editing}
                            />
                            <Input
                              data-testid={`exp-company-${idx}`}
                              placeholder="Company"
                              value={exp.company}
                              onChange={(e) =>
                                updateExperience(idx, 'company', e.target.value)
                              }
                              disabled={!editing}
                            />
                          </div>
                          <Input
                            data-testid={`exp-duration-${idx}`}
                            placeholder="Duration (e.g., 2020-2024)"
                            value={exp.duration}
                            onChange={(e) =>
                              updateExperience(idx, 'duration', e.target.value)
                            }
                            disabled={!editing}
                          />
                          <Textarea
                            data-testid={`exp-description-${idx}`}
                            placeholder="Description"
                            value={exp.description}
                            onChange={(e) =>
  updateExperience(idx, 'description', e.target.value)
                            }
                            rows={3}
                            disabled={!editing}
                          />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                {/* Education */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-gray-900">
                      Education
                    </h3>
                    {editing && (
                      <Button
                        size="sm"
                        onClick={addEducation}
                        variant="outline"
                        data-testid="add-education-button"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add Education
                      </Button>
                    )}
                  </div>
                  <div className="space-y-4">
                    {editData.education.map((edu, idx) => (
                      <Card key={idx} className="border-2">
                        <CardContent className="pt-6 space-y-3">
                          <div className="flex justify-between items-start">
                            <h4 className="font-semibold">
                              Education {idx + 1}
                            </h4>
                            {editing && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => removeEducation(idx)}
                                className="text-red-500 hover:text-red-700"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                          <Input
                            data-testid={`edu-degree-${idx}`}
                            placeholder="Degree"
                            value={edu.degree}
                            onChange={(e) =>
                              updateEducation(idx, 'degree', e.target.value)
                            }
                            disabled={!editing}
                          />
                          <Input
                            data-testid={`edu-institution-${idx}`}
                            placeholder="Institution"
                            value={edu.institution}
                            onChange={(e) =>
                              updateEducation(idx, 'institution', e.target.value)
                            }
                            disabled={!editing}
                          />
                          <Input
                            data-testid={`edu-year-${idx}`}
                            placeholder="Year"
                            value={edu.year}
                            onChange={(e) =>
                              updateEducation(idx, 'year', e.target.value)
                            }
                            disabled={!editing}
                          />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}