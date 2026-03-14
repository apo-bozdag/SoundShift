import { useState, useCallback, useRef } from 'react';

export function useSync() {
  const [progress, setProgress] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState(null);
  const eventSourceRef = useRef(null);

  const startSync = useCallback(() => {
    if (isRunning) return;

    setIsRunning(true);
    setError(null);
    setProgress({ step: 'starting', message: 'Sync başlıyor...' });

    const es = new EventSource('/api/sync/start');
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setProgress(data);

        if (data.step === 'done') {
          es.close();
          setIsRunning(false);
        }

        if (data.step === 'error') {
          es.close();
          setIsRunning(false);
          setError(data.message);
        }
      } catch (err) {
        console.error('SSE parse error:', err);
      }
    };

    es.onerror = () => {
      es.close();
      setIsRunning(false);
      // Bağlantı kopsa bile sync kısmen tamamlanmış olabilir, done gibi davran
      setProgress(prev => {
        if (prev?.step === 'done') return prev;
        return { step: 'done', message: 'Bağlantı kesildi, mevcut veri yükleniyor...' };
      });
    };
  }, [isRunning]);

  const cancel = useCallback(() => {
    eventSourceRef.current?.close();
    setIsRunning(false);
    setProgress(null);
  }, []);

  return { progress, isRunning, error, startSync, cancel };
}
