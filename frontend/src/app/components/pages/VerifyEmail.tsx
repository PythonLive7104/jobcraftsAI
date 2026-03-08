import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { buildUrl, fetchWithAuth, getErrorMessage, parseResponseBody } from '../../lib/api';

export function VerifyEmail() {
  const location = useLocation();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [resending, setResending] = useState(false);
  const [status, setStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const { uid, token, verified, error } = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return {
      uid: params.get('uid') ?? '',
      token: params.get('token') ?? '',
      verified: params.get('verified') === '1',
      error: params.get('error') ?? '',
    };
  }, [location.search]);

  useEffect(() => {
    if (verified) {
      setStatus('success');
      return;
    }
    if (error) {
      setStatus('error');
      setErrorMessage('Verification link is invalid or expired.');
      return;
    }
    if (uid && token) {
      setStatus('verifying');
      const verify = async () => {
        try {
          const response = await fetch(buildUrl('/auth/verify-email/'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid, token }),
          });
          const data = await parseResponseBody(response);
          if (!response.ok) {
            throw new Error(getErrorMessage(data, 'Verification failed'));
          }
          setStatus('success');
        } catch (err) {
          setStatus('error');
          setErrorMessage(err instanceof Error ? err.message : 'Verification failed');
        }
      };
      void verify();
    } else {
      setStatus('idle');
    }
  }, [uid, token, verified, error]);

  if (status === 'verifying') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="w-full max-w-md border-border/50">
          <CardHeader>
            <CardTitle>Verifying your email</CardTitle>
            <CardDescription>Please wait while we confirm your email address.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="animate-pulse h-4 bg-muted rounded w-3/4" />
              <div className="animate-pulse h-4 bg-muted rounded w-1/2" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'success') {
    const goToDashboard = async () => {
      await refreshUser();
      navigate('/dashboard', { replace: true });
    };
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="w-full max-w-md border-border/50">
          <CardHeader>
            <CardTitle className="text-green-600 dark:text-green-400">Email verified!</CardTitle>
            <CardDescription>Your email has been confirmed. You can now use all features.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => void goToDashboard()}>
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="w-full max-w-md border-border/50">
          <CardHeader>
            <CardTitle className="text-destructive">Verification failed</CardTitle>
            <CardDescription>{errorMessage}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                The link may have expired or already been used. Try requesting a new verification email from your account settings.
              </p>
              <Button asChild className="w-full">
                <Link to="/login">Back to Login</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleResend = async () => {
    setResending(true);
    try {
      const response = await fetchWithAuth('/auth/resend-verification-email/', { method: 'POST' });
      const data = await parseResponseBody(response);
      if (!response.ok) {
        throw new Error(getErrorMessage(data, 'Failed to resend'));
      }
      toast.success('Verification email sent. Check your inbox.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to resend verification email');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="w-full max-w-md border-border/50">
        <CardHeader>
          <CardTitle>Verify your email</CardTitle>
          <CardDescription>Check your inbox for the verification link we sent.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            If you didn&apos;t receive the email, check your spam folder.
          </p>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => void handleResend()}
            disabled={resending}
          >
            {resending ? 'Sending...' : 'Resend verification email'}
          </Button>
          <Button asChild variant="ghost" className="w-full">
            <Link to="/login">Back to Login</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
