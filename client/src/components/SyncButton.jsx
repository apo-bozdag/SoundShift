import { useI18n } from '../i18n/index.jsx';

export default function SyncButton({ progress, isRunning, error, onSync }) {
  const { t } = useI18n();

  const getProgressPercent = () => {
    if (!progress || !progress.total || !progress.current) return 0;
    return Math.round((progress.current / progress.total) * 100);
  };

  const getStatusText = () => {
    if (!progress) return '';
    if (progress.step === 'songs') {
      if (progress.current && progress.total) {
        return t('sync.songs.progress', { current: progress.current, total: progress.total });
      }
      return progress.message || t('sync.songs.fetching');
    }
    if (progress.step === 'artists') {
      if (progress.current && progress.total) {
        return t('sync.artists.progress', { current: progress.current, total: progress.total });
      }
      return progress.message || t('sync.artists.fetching');
    }
    if (progress.step === 'timeline') return t('sync.timeline');
    if (progress.step === 'done') return t('sync.done');
    if (progress.step === 'error') return t('sync.error', { message: progress.message });
    return progress.message || '';
  };

  return (
    <div className="sync-container">
      <button
        className={`sync-btn ${isRunning ? 'syncing' : ''}`}
        onClick={onSync}
        disabled={isRunning}
      >
        {isRunning ? t('sync.running') : t('sync.start')}
      </button>

      {isRunning && progress && (
        <div className="progress-wrapper">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${getProgressPercent()}%` }}
            />
          </div>
          <p className="progress-text">{getStatusText()}</p>
        </div>
      )}

      {error && <p className="error-text">{error}</p>}

      {progress?.step === 'done' && !isRunning && (
        <p className="success-text">{t('sync.done')}</p>
      )}
    </div>
  );
}
