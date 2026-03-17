import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, Download, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { ResumeEditor, type ResumeEditorHandle } from '../ResumeEditor';
import { fetchWithAuth, getErrorMessage, parseResponseBody } from '../../lib/api';

export function ResumeEditPdf() {
  const { resumeId } = useParams<{ resumeId: string }>();
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [filename, setFilename] = useState('resume');
  const editorRef = useRef<ResumeEditorHandle>(null);

  useEffect(() => {
    if (!resumeId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchWithAuth(`/resumes/${resumeId}/pdf-as-html/`)
      .then(async (res) => {
        const data = await parseResponseBody(res);
        if (cancelled) return;
        if (!res.ok) {
          setError(getErrorMessage(data, 'Failed to load PDF for editing'));
          return;
        }
        const payload = data as { html?: string };
        setHtmlContent(payload.html || '<p></p>');
        setFilename('edited-resume');
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [resumeId]);

  const handleSavePdf = async () => {
    const html = editorRef.current?.getHTML();
    if (!html) {
      toast.error('No content to save');
      return;
    }
    setSaving(true);
    try {
      const response = await fetchWithAuth(`/resumes/${resumeId}/save-pdf/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html }),
      });
      const data = await parseResponseBody(response);
      if (!response.ok) {
        throw new Error(getErrorMessage(data, 'Save failed'));
      }
      toast.success('Resume saved. Your edited file has replaced the original.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPdf = async () => {
    const html = editorRef.current?.getHTML();
    if (!html) {
      toast.error('No content to export');
      return;
    }
    setDownloading(true);
    try {
      const response = await fetchWithAuth('/export-pdf/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html, filename }),
      });
      if (!response.ok) {
        const data = await parseResponseBody(response);
        throw new Error(getErrorMessage(data, 'Export failed'));
      }
      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition');
      const match = disposition?.match(/filename="?([^";\n]+)"?/);
      const name = match?.[1] ?? `${filename}.pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('PDF downloaded');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setDownloading(false);
    }
  };

  if (!resumeId) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <p className="text-muted-foreground">Invalid resume</p>
        <Link to="/resume">
          <Button variant="outline" className="mt-4 gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Resume
          </Button>
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 flex items-center justify-center min-h-[300px]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
          <p className="text-muted-foreground">Loading PDF for editing...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Card className="border-amber-500/40">
          <CardContent className="p-6">
            <p className="text-amber-300 mb-4">{error}</p>
            <Link to="/resume">
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back to Resume
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Edit PDF Resume</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Edit your resume, save to replace the original, or download as PDF.
            </p>
          </div>
          <Link to="/resume">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          </Link>
        </div>

        <Card className="border-border/50">
          <CardHeader>
            <CardTitle>Resume Content</CardTitle>
            <CardDescription>
              Make changes to your resume. Use the toolbar for bold, italic, and lists. Save to replace the uploaded file, or download a copy.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ResumeEditor
              ref={editorRef}
              content={htmlContent}
              contentKey={resumeId}
              contentMode="html"
              minHeight="500px"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={handleSavePdf}
                disabled={saving}
                variant="default"
                className="gap-2"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {saving ? 'Saving...' : 'Save & Replace Original'}
              </Button>
              <Button
                onClick={handleDownloadPdf}
                disabled={downloading}
                variant="outline"
                className="gap-2"
              >
              {downloading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
                {downloading ? 'Creating PDF...' : 'Download as PDF'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
