import { useState, useEffect, useCallback } from 'react';

export function useRouter() {
  const getPage = () => (window.location.hash.slice(1) || '/');
  const [page, setPage] = useState(getPage);

  useEffect(() => {
    const handler = () => setPage(getPage());
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  const navigate = useCallback((path) => {
    window.location.hash = path;
  }, []);

  return { page, navigate };
}
