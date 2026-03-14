import { useState, useCallback } from 'react';

export function useTimeline() {
  const [timeline, setTimeline] = useState(null);
  const [stats, setStats] = useState(null);
  const [yearDetail, setYearDetail] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchTimeline = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/timeline');
      if (res.ok) {
        const data = await res.json();
        setTimeline(data);
      }
    } catch (err) {
      console.error('Timeline fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Stats fetch error:', err);
    }
  }, []);

  const fetchYearDetail = useCallback(async (year) => {
    setYearDetail({ year, loading: true });
    try {
      const res = await fetch(`/api/timeline/${year}`);
      if (res.ok) {
        const data = await res.json();
        setYearDetail(data);
      }
    } catch (err) {
      console.error('Year detail fetch error:', err);
    }
  }, []);

  const clearYearDetail = useCallback(() => setYearDetail(null), []);

  return {
    timeline, stats, yearDetail, loading,
    fetchTimeline, fetchStats, fetchYearDetail, clearYearDetail
  };
}
