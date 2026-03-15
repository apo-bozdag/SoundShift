import { useState, useRef, useCallback } from 'react';
import { useI18n } from '../i18n/index.jsx';

const API = import.meta.env.VITE_API_URL || '';

const STEPS = [
  { key: 'privacy', icon: '1' },
  { key: 'request', icon: '2' },
  { key: 'wait', icon: '3' },
  { key: 'upload', icon: '4' },
];

function SpotifyIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#1DB954">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
    </svg>
  );
}

export default function UploadPage({ onComplete, onBack }) {
  const { t } = useI18n();
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);
  const fileRef = useRef(null);

  const handleFile = useCallback((f) => {
    if (f && (f.name.endsWith('.zip') || f.type === 'application/zip' || f.type === 'application/x-zip-compressed')) {
      setFile(f);
      setError(null);
    } else {
      setError(t('upload.invalidFile'));
    }
  }, [t]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer?.files?.[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const startUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${API}/api/upload/start`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      setUploadResult(data);
      setUploading(false);

      // Start processing via SSE
      setProcessing(true);
      const evtSource = new EventSource(`${API}/api/upload/process`, { withCredentials: true });

      evtSource.onmessage = (e) => {
        try {
          const prog = JSON.parse(e.data);
          setProgress(prog);

          if (prog.step === 'done') {
            evtSource.close();
            setProcessing(false);
            setTimeout(() => onComplete?.(), 1500);
          }
          if (prog.step === 'error') {
            evtSource.close();
            setProcessing(false);
            setError(prog.message);
          }
        } catch {}
      };

      evtSource.onerror = () => {
        evtSource.close();
        setProcessing(false);
        setError(t('upload.connectionLost'));
      };
    } catch (err) {
      setUploading(false);
      setError(err.message);
    }
  };

  const getProgressText = () => {
    if (!progress) return '';
    switch (progress.step) {
      case 'tracks':
        return progress.current != null
          ? `${t('upload.fetchingTracks')} ${progress.current}/${progress.total}`
          : progress.message;
      case 'songs':
        return progress.message;
      case 'artists':
        return progress.current != null
          ? `${t('upload.enrichingGenres')} ${progress.current}/${progress.total}`
          : progress.message;
      case 'playlists':
        return progress.current != null
          ? `${t('upload.savingPlaylists')} ${progress.current}/${progress.total}${progress.playlistName ? ` — ${progress.playlistName}` : ''}`
          : progress.message;
      case 'timeline':
        return t('upload.computingTimeline');
      case 'done':
        return t('upload.done');
      default:
        return progress.message || '';
    }
  };

  const getProgressPercent = () => {
    if (!progress) return 0;
    const weights = { tracks: 20, songs: 10, artists: 50, playlists: 10, timeline: 5, done: 100 };
    const stepOrder = ['tracks', 'songs', 'artists', 'playlists', 'timeline', 'done'];
    const idx = stepOrder.indexOf(progress.step);
    if (idx < 0) return 0;

    let base = 0;
    for (let i = 0; i < idx; i++) base += weights[stepOrder[i]];

    const stepWeight = weights[progress.step] || 0;
    const stepProgress = (progress.current && progress.total) ? progress.current / progress.total : 0;
    return Math.min(base + stepWeight * stepProgress, 100);
  };

  return (
    <div className="upload-page">
      <header className="upload-header">
        <button className="upload-back" onClick={onBack}>&larr;</button>
        <SpotifyIcon size={24} />
        <h1>{t('upload.title')}</h1>
      </header>

      {!processing && !uploadResult && (
        <>
          <p className="upload-desc">{t('upload.description')}</p>

          <div className="upload-steps">
            {STEPS.map((step, i) => (
              <div key={step.key} className="upload-step">
                <div className="upload-step-num">{step.icon}</div>
                <div className="upload-step-text">
                  <strong>{t(`upload.step${i + 1}.title`)}</strong>
                  <span>{t(`upload.step${i + 1}.desc`)}</span>
                </div>
              </div>
            ))}
          </div>

          <a
            href="https://www.spotify.com/account/privacy/"
            target="_blank"
            rel="noopener noreferrer"
            className="upload-spotify-link"
          >
            <SpotifyIcon size={16} />
            {t('upload.openPrivacy')}
          </a>

          <div
            className={`upload-dropzone ${dragOver ? 'dragover' : ''} ${file ? 'has-file' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".zip"
              style={{ display: 'none' }}
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            {file ? (
              <div className="upload-file-info">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                </svg>
                <span>{file.name}</span>
                <span className="upload-file-size">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
              </div>
            ) : (
              <div className="upload-drop-text">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                <span>{t('upload.dropzone')}</span>
                <span className="upload-drop-hint">{t('upload.dropzoneHint')}</span>
              </div>
            )}
          </div>

          {error && <p className="upload-error">{error}</p>}

          <button
            className="upload-submit"
            disabled={!file || uploading}
            onClick={startUpload}
          >
            {uploading ? t('upload.uploading') : t('upload.startProcess')}
          </button>
        </>
      )}

      {(processing || uploadResult) && (
        <div className="upload-processing">
          {uploadResult && !processing && !progress && (
            <div className="upload-summary">
              <p>{t('upload.parsed', { tracks: uploadResult.trackCount, playlists: uploadResult.playlistCount })}</p>
            </div>
          )}

          {(processing || progress) && (
            <>
              <div className="upload-progress-bar">
                <div className="upload-progress-fill" style={{ width: `${getProgressPercent()}%` }} />
              </div>
              <p className="upload-progress-text">{getProgressText()}</p>

              {progress?.step === 'done' && (
                <div className="upload-done">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#1DB954" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                  <p>{t('upload.complete')}</p>
                </div>
              )}
            </>
          )}

          {error && <p className="upload-error">{error}</p>}
        </div>
      )}
    </div>
  );
}
