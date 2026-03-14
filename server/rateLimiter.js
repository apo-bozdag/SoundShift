import Bottleneck from 'bottleneck';

// Spotify: ~20 req / 30 saniye (dev mode, biraz agresif)
export const spotifyLimiter = new Bottleneck({
  reservoir: 25,
  reservoirRefreshAmount: 25,
  reservoirRefreshInterval: 30000,
  maxConcurrent: 5,
  minTime: 100
});

// Last.fm: 5 req/sec resmi, 4 req/sec agresif
export const lastfmLimiter = new Bottleneck({
  maxConcurrent: 4,
  minTime: 250
});

// MusicBrainz: kesinlikle 1 req/sec
export const mbLimiter = new Bottleneck({
  maxConcurrent: 1,
  minTime: 1100
});

// Spotify 429 auto-retry
spotifyLimiter.on('failed', (error, jobInfo) => {
  if (error?.status === 429) {
    const wait = parseInt(error.headers?.['retry-after'] || '5') * 1000;
    if (jobInfo.retryCount < 3) return wait;
  }
});
