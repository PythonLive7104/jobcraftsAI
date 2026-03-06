import { Outlet, useLocation } from 'react-router';
import { Navigation } from './Navigation';
import { TawkChat } from './TawkChat';
import { useEffect } from 'react';
import { applySeoForPath } from '../lib/seo';

export function Layout() {
  const location = useLocation();
  const hideNavigationPaths = new Set(['/', '/login', '/register']);
  const shouldHideNavigation = hideNavigationPaths.has(location.pathname);

  useEffect(() => {
    applySeoForPath(location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background">
      {!shouldHideNavigation && <Navigation />}
      <TawkChat />
      <main>
        <Outlet />
      </main>
    </div>
  );
}
