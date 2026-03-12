import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { CheckCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

declare global {
  interface Window {
    ttq?: {
      track: (event: string, props?: Record<string, unknown>) => void;
      page: () => void;
    };
  }
}

const PLAN_VALUES: Record<string, number> = {
  starter: 5,
  pro: 12,
};

export function PaymentSuccess() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { plan?: string; message?: string } | null;

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    // Fire TikTok CompletePayment conversion event
    if (typeof window !== 'undefined' && window.ttq) {
      const plan = state?.plan || 'unknown';
      const value = PLAN_VALUES[plan] ?? 0;
      window.ttq.track('CompletePayment', {
        content_id: plan,
        value,
        currency: 'USD',
      });
    }
  }, [isAuthenticated, navigate, state?.plan]);

  if (!isAuthenticated) return null;

  const plan = state?.plan || 'subscription';
  const message = state?.message || 'Payment verified successfully.';

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
            <CheckCircle className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
          </div>
          <CardTitle className="text-2xl">Payment Successful</CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-sm text-muted-foreground">
            Thank you for upgrading to {plan === 'starter' ? 'Starter' : plan === 'pro' ? 'Pro' : plan}. You now have full access to all features.
          </p>
          <Button asChild className="w-full" size="lg">
            <Link to="/dashboard">
              Go to Dashboard
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
