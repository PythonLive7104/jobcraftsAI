import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Upload, CheckCircle, Loader2, FileEdit } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { fetchWithAuth, getErrorMessage, parseResponseBody } from '../../lib/api';

type ParsedResume = {
  id: string;
  filename: string;
  file_type: string;
  parse_status: 'pending' | 'processing' | 'done' | 'failed';
  parse_error: string;
  extracted_text: string;
  created_at: string;
  resume_usage?: {
    used: number;
    limit: number;
  };
};

type ResumeListItem = {
  id: string;
  filename: string;
  file_type: string;
  parse_status: string;
  created_at: string;
};

type ResumeUsageSummary = {
  used: number;
  limit: number;
};

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

export function ResumeUpload() {
  const navigate = useNavigate();
  const [uploading, setUploading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [switchingResume, setSwitchingResume] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [fileName, setFileName] = useState('');
  const [parsedData, setParsedData] = useState<ParsedResume | null>(null);
  const [savedResumes, setSavedResumes] = useState<ResumeListItem[]>([]);
  const [resumeUsage, setResumeUsage] = useState<ResumeUsageSummary | null>(null);

  const isFileSupported = (file: File) => {
    if (ALLOWED_MIME_TYPES.has(file.type)) return true;
    return file.name.toLowerCase().endsWith('.pdf') || file.name.toLowerCase().endsWith('.docx');
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!isFileSupported(file)) {
      toast.error('Unsupported file type. Please upload a PDF or DOCX file.');
      event.target.value = '';
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast.error('File is too large. Please upload a file under 5MB.');
      event.target.value = '';
      return;
    }

    setFileName(file.name);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('original_file', file);

      const response = await fetchWithAuth('/resumes/upload/', {
        method: 'POST',
        body: formData,
      });

      const data = await parseResponseBody(response);
      if (!response.ok) {
        throw new Error(getErrorMessage(data, 'Failed to upload resume'));
      }

      const parsedResume = data as ParsedResume;
      setParsedData(parsedResume);
      setUploaded(true);
      if (parsedResume.resume_usage) {
        setResumeUsage(parsedResume.resume_usage);
      } else {
        void loadResumeUsage();
      }
      window.localStorage.setItem('resumeai-current-resume-id', parsedResume.id);
      void loadSavedResumes();
      toast.success(parsedResume.parse_status === 'done' ? 'Resume uploaded and parsed successfully' : 'Resume uploaded');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const fetchResumeDetail = async (resumeId: string) => {
    const detailResponse = await fetchWithAuth(`/resumes/${resumeId}/`);
    const detailData = await parseResponseBody(detailResponse);
    if (!detailResponse.ok) {
      throw new Error(getErrorMessage(detailData, 'Failed to load saved resume'));
    }
    const restored = detailData as ParsedResume;
    setParsedData(restored);
    setUploaded(true);
    setFileName(restored.filename);
    window.localStorage.setItem('resumeai-current-resume-id', restored.id);
  };

  const loadSavedResumes = async () => {
    const listResponse = await fetchWithAuth('/resumes/');
    const listData = await parseResponseBody(listResponse);
    if (!listResponse.ok) {
      throw new Error(getErrorMessage(listData, 'Failed to load resumes'));
    }
    const items = (listData as { items?: ResumeListItem[] })?.items ?? [];
    setSavedResumes(items);
    return items;
  };

  const loadResumeUsage = async () => {
    const response = await fetchWithAuth('/me/');
    const data = await parseResponseBody(response);
    if (!response.ok) {
      throw new Error(getErrorMessage(data, 'Failed to load subscription usage'));
    }
    const payload = data as {
      subscription?: {
        limits?: { resumes?: number };
        usage?: { resumes?: number };
      };
    };
    const limit = payload.subscription?.limits?.resumes ?? 0;
    const used = payload.subscription?.usage?.resumes ?? 0;
    setResumeUsage({ used, limit });
  };

  const handleSelectSavedResume = async (resumeId: string) => {
    if (!resumeId) return;
    setSwitchingResume(true);
    try {
      await fetchResumeDetail(resumeId);
      toast.success('Loaded saved resume');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to switch resume');
    } finally {
      setSwitchingResume(false);
    }
  };

  useEffect(() => {
    const restoreSavedResume = async () => {
      try {
        const [items] = await Promise.all([loadSavedResumes(), loadResumeUsage()]);
        const storedResumeId = window.localStorage.getItem('resumeai-current-resume-id');
        if (storedResumeId) {
          try {
            await fetchResumeDetail(storedResumeId);
            return;
          } catch {
            window.localStorage.removeItem('resumeai-current-resume-id');
          }
        }

        const latestResumeId = items[0]?.id;
        if (!latestResumeId) return;
        await fetchResumeDetail(latestResumeId);
      } catch {
        // If restore fails, user can still upload normally.
      } finally {
        setInitializing(false);
      }
    };

    void restoreSavedResume();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Upload & Parse Resume</h1>
          <p className="text-muted-foreground">Upload your resume to extract text for analysis</p>
        </div>

        {resumeUsage && (
          <Card className="border-border/50 mb-6">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">
                Monthly resume usage: <span className="font-medium text-foreground">{resumeUsage.used}/{resumeUsage.limit}</span>
              </p>
            </CardContent>
          </Card>
        )}

        {!initializing && savedResumes.length > 0 && (
          <Card className="border-border/50 mb-6">
            <CardHeader>
              <CardTitle>Saved Resumes</CardTitle>
              <CardDescription>Select an existing resume or upload a new one</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Label htmlFor="saved-resume-select">Choose saved resume</Label>
              <select
                id="saved-resume-select"
                value={parsedData?.id ?? ''}
                onChange={(event) => {
                  void handleSelectSavedResume(event.target.value);
                }}
                disabled={switchingResume}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="" disabled>
                  Select a saved resume
                </option>
                {savedResumes.map((resume) => (
                  <option key={resume.id} value={resume.id}>
                    {resume.filename || resume.id} - {resume.parse_status} - {new Date(resume.created_at).toLocaleDateString()}
                  </option>
                ))}
              </select>
              {switchingResume && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading selected resume...
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {initializing ? (
          <Card className="border-border/50">
            <CardContent className="p-8">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading saved resume...
              </div>
            </CardContent>
          </Card>
        ) : !uploaded ? (
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle>Upload Your Resume</CardTitle>
              <CardDescription>Supports PDF and DOCX formats</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border-2 border-dashed border-border rounded-lg p-12 text-center hover:border-indigo-500 transition-colors">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500/10 to-cyan-500/10 flex items-center justify-center">
                    <Upload className="w-8 h-8 text-indigo-400" />
                  </div>
                  <div>
                    <Label htmlFor="resume-upload" className="cursor-pointer">
                      <span className="text-indigo-400 hover:text-indigo-300">Click to upload</span>
                      {' or drag and drop'}
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">PDF or DOCX (max 5MB)</p>
                  </div>
                  <input
                    id="resume-upload"
                    type="file"
                    accept=".pdf,.docx"
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                  {uploading && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Uploading {fileName}...
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <Card className="border-emerald-500/50 bg-gradient-to-br from-emerald-500/10 to-cyan-500/10">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Resume Uploaded</h3>
                    <p className="text-sm text-muted-foreground">
                      Status: {parsedData?.parse_status} {parsedData?.parse_error ? `• ${parsedData.parse_error}` : ''}
                    </p>
                    {parsedData?.resume_usage && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Monthly resume usage: {parsedData.resume_usage.used}/{parsedData.resume_usage.limit}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader>
                <CardTitle>Extracted Text Preview</CardTitle>
                <CardDescription>{parsedData?.filename}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border border-border/60 bg-muted/20 p-4 max-h-[380px] overflow-auto">
                  <pre className="text-xs whitespace-pre-wrap text-muted-foreground">
                    {parsedData?.extracted_text?.slice(0, 4500) || 'No extracted text returned.'}
                  </pre>
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => {
                  setUploaded(false);
                  setParsedData(null);
                  setFileName('');
                  window.localStorage.removeItem('resumeai-current-resume-id');
                }}
                variant="outline"
              >
                Upload Different Resume
              </Button>
              {parsedData?.file_type?.toLowerCase() === 'pdf' && (
                <Link to={`/resume/edit/${parsedData.id}`}>
                  <Button variant="outline" className="gap-2">
                    <FileEdit className="w-4 h-4" />
                    Edit PDF
                  </Button>
                </Link>
              )}
              <Button
                onClick={() => {
                  if (!parsedData?.id) {
                    toast.error('Upload a resume first');
                    return;
                  }
                  navigate('/job-analysis');
                }}
              >
                Continue to Job Analysis
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
