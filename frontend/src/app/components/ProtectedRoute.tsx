import { Link, Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '../context/AuthContext';

export function ProtectedRoute() {
  const { user, isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <p className="text-muted-foreground">Checking session...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  const showVerifyBanner = user && user.email_verified === false;

  return (
    <>
      {showVerifyBanner && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-3 text-center text-sm">
          <span className="text-amber-700 dark:text-amber-400">
            Please verify your email to upload resumes and use optimization features.{' '}
          </span>
          <Link to="/verify-email" className="font-medium text-amber-600 dark:text-amber-300 hover:underline ml-1">
            Check your inbox
          </Link>
        </div>
      )}
      <Outlet />
    </>
  );
}
