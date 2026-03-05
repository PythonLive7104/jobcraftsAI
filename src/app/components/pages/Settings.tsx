import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useTheme } from 'next-themes';
import { Moon, Sun, User, CreditCard, Loader2, CalendarClock } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { fetchWithAuth, getErrorMessage, parseResponseBody } from '../../lib/api';

type ProfileForm = {
  first_name: string;
  last_name: string;
  email: string;
  username: string;
};

type PaymentHistoryItem = {
  id: string;
  reference: string;
  plan: string;
  amount_major: string;
  currency: string;
  status: string;
  created_at: string;
};

type SubscriptionData = {
  plan: string;
  period_start: string;
  limits: {
    ats: number;
  };
  usage: {
    ats: number;
  };
};

export function Settings() {
  const { refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [profile, setProfile] = useState<ProfileForm>({
    first_name: '',
    last_name: '',
    email: '',
    username: '',
  });
  const [payments, setPayments] = useState<PaymentHistoryItem[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  useEffect(() => {
    const loadSettingsData = async () => {
      setLoading(true);
      try {
        const [meResponse, paymentResponse, appMeResponse] = await Promise.all([
          fetchWithAuth('/auth/me/'),
          fetchWithAuth('/payments/history/'),
          fetchWithAuth('/me/'),
        ]);

        const meData = await parseResponseBody(meResponse);
        if (!meResponse.ok) {
          throw new Error(getErrorMessage(meData, 'Unable to load account profile'));
        }
        const me = meData as {
          first_name?: string;
          last_name?: string;
          email?: string;
          username?: string;
        };
        setProfile({
          first_name: me.first_name ?? '',
          last_name: me.last_name ?? '',
          email: me.email ?? '',
          username: me.username ?? '',
        });

        const paymentData = await parseResponseBody(paymentResponse);
        if (!paymentResponse.ok) {
          throw new Error(getErrorMessage(paymentData, 'Unable to load payment history'));
        }
        const payload = paymentData as { items?: PaymentHistoryItem[] };
        setPayments(Array.isArray(payload.items) ? payload.items : []);

        const appMeData = await parseResponseBody(appMeResponse);
        if (appMeResponse.ok) {
          const appPayload = appMeData as { subscription?: SubscriptionData };
          setSubscription(appPayload.subscription ?? null);
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Unable to load settings');
      } finally {
        setLoading(false);
      }
    };

    void loadSettingsData();
  }, []);

  const handleProfileSave = async () => {
    setSavingProfile(true);
    try {
      const response = await fetchWithAuth('/auth/me/', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: profile.first_name,
          last_name: profile.last_name,
          email: profile.email,
        }),
      });
      const data = await parseResponseBody(response);
      if (!response.ok) {
        throw new Error(getErrorMessage(data, 'Unable to save profile'));
      }
      await refreshUser();
      toast.success('Profile updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const atsSummary = useMemo(() => {
    if (!subscription) return 'Loading usage...';
    return `${Math.max(subscription.limits.ats - subscription.usage.ats, 0)} of ${subscription.limits.ats} ATS optimizations remaining`;
  }, [subscription]);

  const planName = subscription ? subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1) : 'Free';
  const hasSuccessfulPayment = payments.some((item) => item.status === 'success');

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to delete your account? This will permanently remove your profile and data.',
    );
    if (!confirmed) return;

    setDeletingAccount(true);
    try {
      const response = await fetchWithAuth('/auth/me/', {
        method: 'DELETE',
      });
      const data = await parseResponseBody(response);
      if (!response.ok) {
        throw new Error(getErrorMessage(data, 'Unable to delete account'));
      }
      logout();
      toast.success('Account deleted successfully');
      navigate('/', { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to delete account');
    } finally {
      setDeletingAccount(false);
    }
  };

  const getStatusClassName = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'pending':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      default:
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Settings</h1>
          <p className="text-muted-foreground">Manage your account profile, appearance, and billing history</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Loading settings...
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5" />
                    Profile Information
                  </CardTitle>
                  <CardDescription>Update your personal account details</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="firstName">First Name</Label>
                      <Input
                        id="firstName"
                        value={profile.first_name}
                        onChange={(event) =>
                          setProfile((current) => ({ ...current, first_name: event.target.value }))
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input
                        id="lastName"
                        value={profile.last_name}
                        onChange={(event) =>
                          setProfile((current) => ({ ...current, last_name: event.target.value }))
                        }
                      />
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="username">Username</Label>
                      <Input id="username" value={profile.username} disabled />
                    </div>
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={profile.email}
                        onChange={(event) =>
                          setProfile((current) => ({ ...current, email: event.target.value }))
                        }
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={handleProfileSave} disabled={savingProfile}>
                      {savingProfile ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5" />
                    Payment History
                  </CardTitle>
                  <CardDescription>Recent payment attempts and completed transactions</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {payments.length === 0 ? (
                    <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                      No payments yet. Upgrade from the pricing page when you are ready.
                    </div>
                  ) : (
                    payments.map((payment) => (
                      <div
                        key={payment.id}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-md border border-border p-3"
                      >
                        <div className="min-w-0">
                          <p className="font-medium">
                            {payment.currency} {payment.amount_major} - {payment.plan.toUpperCase()}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">{payment.reference}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge className={getStatusClassName(payment.status)}>{payment.status}</Badge>
                          <p className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(payment.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                    Appearance
                  </CardTitle>
                  <CardDescription>Select how JobCrafts AI looks</CardDescription>
                </CardHeader>
                <CardContent>
                  <Label className="mb-2 block">Theme</Label>
                  <Select value={theme} onValueChange={setTheme}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              <Card className="border-indigo-500/40 bg-gradient-to-br from-indigo-500/10 to-cyan-500/10">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{planName} Plan</span>
                    <Badge className={hasSuccessfulPayment ? 'bg-emerald-500/20 text-emerald-300' : ''}>
                      {hasSuccessfulPayment ? 'Active' : 'Free'}
                    </Badge>
                  </CardTitle>
                  <CardDescription>{atsSummary}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <CalendarClock className="w-3.5 h-3.5" />
                    Billing period started:{' '}
                    {subscription?.period_start ? new Date(subscription.period_start).toLocaleDateString() : 'N/A'}
                  </div>
                  <Link to="/pricing">
                    <Button className="w-full">Manage Plan</Button>
                  </Link>
                </CardContent>
              </Card>

              <Card className="border-rose-500/40 bg-rose-500/5">
                <CardHeader>
                  <CardTitle className="text-rose-400">Delete Account</CardTitle>
                  <CardDescription>
                    Permanently remove your account and associated data. This action cannot be undone.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={handleDeleteAccount}
                    disabled={deletingAccount}
                  >
                    {deletingAccount ? 'Deleting account...' : 'Delete Account'}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
