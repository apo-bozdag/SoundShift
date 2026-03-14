import { readFile, writeFile } from 'fs/promises';
import { getArtistMacroGenres } from '../server/genreMap.js';

const LASTFM_KEY = process.env.LASTFM_API_KEY;
if (!LASTFM_KEY) {
  // Try reading from .env
  const env = await readFile('.env', 'utf8');
  var key = env.split('\n').find(l => l.startsWith('LASTFM_API_KEY'))?.split('=')[1]?.trim();
}
const apiKey = LASTFM_KEY || key;

const db = JSON.parse(await readFile('db.json', 'utf8'));

// Artists that used Spotify as source (Last.fm tags missing or empty)
const needsUpdate = Object.entries(db.artists)
  .filter(([, a]) => a.genreSource === 'spotify' || (!a.lastfmTags || a.lastfmTags.length === 0));

console.log(`${needsUpdate.length} artists need Last.fm lookup`);

let updated = 0;
for (const [id, artist] of needsUpdate) {
  try {
    const url = `https://ws.audioscrobbler.com/2.0/?method=artist.getTopTags&artist=${encodeURIComponent(artist.name)}&api_key=${apiKey}&format=json&autocorrect=1`;
    const r = await fetch(url);
    const d = await r.json();

    if (d.toptags?.tag) {
      const tags = d.toptags.tag
        .filter(t => parseInt(t.count) >= 10)
        .slice(0, 15)
        .map(t => ({ name: t.name, count: parseInt(t.count) }));

      if (tags.length > 0) {
        artist.lastfmTags = tags;
        const newMacro = getArtistMacroGenres(tags);
        if (newMacro.length > 0) {
          artist.macroGenres = newMacro;
          artist.genreSource = 'lastfm';
          updated++;
        }
      }
    }
    // Rate limit: 4 req/sec
    await new Promise(r => setTimeout(r, 250));
  } catch (e) {
    console.warn(`Failed: ${artist.name}`, e.message);
  }
  if (updated % 50 === 0 && updated > 0) console.log(`  ${updated} updated...`);
}

// Recompute timelines
for (const userId of Object.keys(db.likedSongs)) {
  const songs = db.likedSongs[userId] || [];
  const yearMap = {};
  for (const song of songs) {
    const year = new Date(song.addedAt).getFullYear();
    if (!yearMap[year]) yearMap[year] = { songs: [], genres: {} };
    yearMap[year].songs.push(song);
    for (const artistId of song.artistIds) {
      const a = db.artists[artistId];
      if (!a) continue;
      for (const g of a.macroGenres) {
        yearMap[year].genres[g] = (yearMap[year].genres[g] || 0) + 1;
      }
    }
  }

  const years = Object.entries(yearMap)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([year, data]) => {
      const sorted = data.songs.sort((a, b) => new Date(a.addedAt) - new Date(b.addedAt));
      const ac = {};
      for (const s of data.songs) {
        for (const aid of s.artistIds) {
          const n = db.artists[aid]?.name || 'Unknown';
          ac[n] = (ac[n] || 0) + 1;
        }
      }
      return {
        year: parseInt(year),
        totalLikes: data.songs.length,
        genres: data.genres,
        topArtists: Object.entries(ac).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count })),
        firstLike: sorted[0] ? { track: sorted[0].name, artist: db.artists[sorted[0].artistIds[0]]?.name, date: sorted[0].addedAt?.split('T')[0] } : null,
        lastLike: sorted.at(-1) ? { track: sorted.at(-1).name, artist: db.artists[sorted.at(-1).artistIds[0]]?.name, date: sorted.at(-1).addedAt?.split('T')[0] } : null
      };
    });

  const all = songs.sort((a, b) => new Date(a.addedAt) - new Date(b.addedAt));
  db.timeline[userId] = {
    generatedAt: new Date().toISOString(),
    years,
    summary: {
      totalTracks: songs.length,
      firstLikeDate: all[0]?.addedAt?.split('T')[0],
      lastLikeDate: all.at(-1)?.addedAt?.split('T')[0]
    }
  };
}

await writeFile('db.json', JSON.stringify(db, null, 2));
console.log(`Done. Updated ${updated} artists from Last.fm`);

// Verification
const checkNames = ['Duman', 'Cem Karaca', 'Barış Manço', 'Yüzyüzeyken Konuşuruz', 'Tarkan', 'mor ve ötesi', 'Depeche Mode'];
for (const name of checkNames) {
  const a = Object.values(db.artists).find(x => x.name === name);
  if (a) console.log(`  ${a.name} -> ${a.macroGenres.join(', ')} (${a.genreSource})`);
}
