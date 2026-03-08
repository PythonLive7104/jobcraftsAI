import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getErrorMessage, parseResponseBody } from '../lib/api';

type AuthUser = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  email_verified?: boolean;
};

type RegisterPayload = {
  username: string;
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
};

const ACCESS_TOKEN_KEY = 'resumeai-access-token';
const REFRESH_TOKEN_KEY = 'resumeai-refresh-token';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000/api';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const buildUrl = (path: string) => `${API_BASE_URL}${path}`;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const saveTokens = (access: string, refresh: string) => {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, access);
    window.localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
  };

  const clearTokens = () => {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  };

  const fetchMe = async (accessToken: string) => {
    const response = await fetch(buildUrl('/auth/me/'), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Unable to fetch profile');
    }

    return (await response.json()) as AuthUser;
  };

  const refreshAccessToken = async () => {
    const refreshToken = window.localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) {
      throw new Error('No refresh token');
    }

    const response = await fetch(buildUrl('/auth/refresh/'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: refreshToken }),
    });

    if (!response.ok) {
      throw new Error('Session expired');
    }

    const body = await parseResponseBody(response);
    if (!response.ok) {
      throw new Error(getErrorMessage(body, 'Session expired'));
    }
    const data = body as { access: string };
    window.localStorage.setItem(ACCESS_TOKEN_KEY, data.access);
    return data.access;
  };

  useEffect(() => {
    const initializeAuth = async () => {
      const accessToken = window.localStorage.getItem(ACCESS_TOKEN_KEY);
      if (!accessToken) {
        setLoading(false);
        return;
      }

      try {
        const profile = await fetchMe(accessToken);
        setUser(profile);
      } catch {
        try {
          const newAccess = await refreshAccessToken();
          const profile = await fetchMe(newAccess);
          setUser(profile);
        } catch {
          clearTokens();
          setUser(null);
        }
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (username: string, password: string) => {
    let response: Response;
    try {
      response = await fetch(buildUrl('/auth/login/'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
    } catch (err) {
      throw new Error('Could not reach server. Ensure the backend is running on port 8000.');
    }

    if (response.status === 404) {
      throw new Error('Authentication endpoint not found. Check backend URL and port.');
    }

    const data = await parseResponseBody(response);
    if (!response.ok) {
      throw new Error(getErrorMessage(data, 'Login failed'));
    }

    const tokens = data as { access: string; refresh: string };
    saveTokens(tokens.access, tokens.refresh);
    const profile = await fetchMe(tokens.access);
    setUser(profile);
  };

  const register = async (payload: RegisterPayload) => {
    let response: Response;
    try {
      response = await fetch(buildUrl('/auth/register/'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      throw new Error('Could not reach server. Ensure the backend is running on port 8000.');
    }

    if (response.status === 404) {
      throw new Error('Registration endpoint not found. Check backend URL and port.');
    }

    const data = await parseResponseBody(response);
    if (!response.ok) {
      throw new Error(getErrorMessage(data, 'Registration failed'));
    }

    const registerData = data as {
      user: AuthUser;
      tokens: { access: string; refresh: string };
    };
    saveTokens(registerData.tokens.access, registerData.tokens.refresh);
    setUser(registerData.user);
  };

  const logout = () => {
    clearTokens();
    setUser(null);
  };

  const refreshUser = async () => {
    const accessToken = window.localStorage.getItem(ACCESS_TOKEN_KEY);
    if (!accessToken) return;
    const profile = await fetchMe(accessToken);
    setUser(profile);
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      login,
      register,
      logout,
      refreshUser,
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
