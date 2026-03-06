import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import { buildUrl, getErrorMessage, parseResponseBody } from '../../lib/api';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sentEmail, setSentEmail] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((current) => (current > 0 ? current - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const requestResetLink = async (requestEmail: string) => {
    const response = await fetch(buildUrl('/auth/forgot-password/'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: requestEmail }),
    });
    const data = await parseResponseBody(response);
    if (!response.ok) {
      throw new Error(getErrorMessage(data, 'Unable to process reset request'));
    }
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await requestResetLink(email);
      toast.success('If this email exists, a reset link has been sent.');
      setSentEmail(email);
      setCooldown(60);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to process reset request');
    } finally {
      setSubmitting(false);
    }
  };

  const onResend = async () => {
    if (!sentEmail || cooldown > 0) return;
    setSubmitting(true);
    try {
      await requestResetLink(sentEmail);
      toast.success('Reset link sent again.');
      setCooldown(60);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to resend reset link');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="w-full max-w-md border-border/50">
        {sentEmail ? (
          <>
            <CardHeader>
              <CardTitle>Check Your Email</CardTitle>
              <CardDescription>
                If an account exists for <span className="font-medium text-foreground">{sentEmail}</span>, we sent a
                password reset link.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full" onClick={onResend} disabled={submitting || cooldown > 0}>
                {submitting ? 'Sending...' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Reset Link'}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setSentEmail('');
                  setCooldown(0);
                }}
              >
                Use a different email
              </Button>
              <p className="text-sm text-muted-foreground text-center">
                Back to{' '}
                <Link to="/login" className="text-indigo-400 hover:text-indigo-300">
                  Login
                </Link>
              </p>
            </CardContent>
          </>
        ) : (
          <>
            <CardHeader>
              <CardTitle>Forgot Password</CardTitle>
              <CardDescription>Enter your email to receive a password reset link</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={onSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? 'Sending link...' : 'Send Reset Link'}
                </Button>
              </form>
              <p className="text-sm text-muted-foreground mt-4 text-center">
                Back to{' '}
                <Link to="/login" className="text-indigo-400 hover:text-indigo-300">
                  Login
                </Link>
              </p>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
