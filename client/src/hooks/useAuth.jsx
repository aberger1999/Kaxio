import { createContext, useContext, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

const AuthContext = createContext(null);

const TOKEN_KEY = 'productivity_hub_token';
const SESSION_KEY = 'productivity_hub_session';

function getSession() {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY));
    const token = localStorage.getItem(TOKEN_KEY);
    // Both session AND token must exist — prevents stale sessions without a JWT
    if (session?.isAuthenticated && token) return session;
    // Clean up mismatched state
    if (session && !token) {
      localStorage.removeItem(SESSION_KEY);
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getSession());

  const login = useCallback(async (email, password) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { ok: false, error: data.detail || 'Invalid email or password.' };
      }
      const data = await res.json();
      localStorage.setItem(TOKEN_KEY, data.token);
      const session = { ...data.user, isAuthenticated: true };
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      setUser(session);
      return { ok: true };
    } catch {
      return { ok: false, error: 'Network error. Please try again.' };
    }
  }, []);

  const register = useCallback(async (name, email, password) => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { ok: false, error: data.detail || 'Registration failed.' };
      }
      const data = await res.json();
      localStorage.setItem(TOKEN_KEY, data.token);
      const session = { ...data.user, isAuthenticated: true };
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      setUser(session);
      return { ok: true };
    } catch {
      return { ok: false, error: 'Network error. Please try again.' };
    }
  }, []);

  const queryClient = useQueryClient();

  const logout = useCallback(() => {
    fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    }).catch(() => {
      // Local logout still proceeds even if network call fails.
    });
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
    // Clear all cached query data to prevent stale data leaking between sessions
    queryClient.clear();
  }, [queryClient]);

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
