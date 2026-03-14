import { useState, useEffect, useCallback } from 'react';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch('/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async () => {
    const res = await fetch('/auth/login');
    const data = await res.json();
    window.location.href = data.url;
  };

  const logout = async () => {
    await fetch('/auth/logout', { method: 'POST' });
    setUser(null);
  };

  return { user, loading, login, logout, refetch: checkAuth };
}
