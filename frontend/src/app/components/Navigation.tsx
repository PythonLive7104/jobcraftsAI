import { Link, NavLink, useLocation } from 'react-router';
import { Moon, Sun, Menu, X } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from './ui/button';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

export function Navigation() {
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Resume', path: '/resume' },
    { label: 'Optimize', path: '/optimize' },
    { label: 'Cover Letter', path: '/cover-letter' },
    { label: 'Interview Prep', path: '/interview-prep' },
    { label: 'Pricing', path: '/pricing' },
  ];

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <nav className="border-b border-border/50 backdrop-blur-xl bg-background/80 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <img src="/logo.png" alt="JobCrafts AI" className="w-8 h-8 rounded-lg object-contain" />
            <span className="font-semibold text-lg">JobCrafts AI</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `text-sm transition-colors ${isActive ? 'text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>

          {/* Right side actions */}
          <div className="flex items-center gap-3">
            <span className="hidden md:inline text-sm text-muted-foreground">
              {user ? `Hi, ${user.first_name || user.username}` : 'Guest'}
            </span>
            {/* Theme Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="hidden md:inline-flex"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </Button>

            {/* Mobile Menu Toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </Button>
            {user && (
              <Button
                variant="outline"
                size="sm"
                className="hidden md:inline-flex"
                onClick={logout}
              >
                Logout
              </Button>
            )}
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-border/50">
            <div className="flex flex-col gap-3">
              {navItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `text-sm transition-colors py-2 ${isActive ? 'text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setTheme(theme === 'dark' ? 'light' : 'dark');
                  setMobileMenuOpen(false);
                }}
                className="justify-start"
              >
                {theme === 'dark' ? (
                  <>
                    <Sun className="w-4 h-4 mr-2" /> Light Mode
                  </>
                ) : (
                  <>
                    <Moon className="w-4 h-4 mr-2" /> Dark Mode
                  </>
                )}
              </Button>
              {user && (
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-start"
                  onClick={() => {
                    logout();
                    setMobileMenuOpen(false);
                  }}
                >
                  Logout
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
