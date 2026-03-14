import { readFile, writeFile } from 'fs/promises';
import { getArtistMacroGenres } from '../server/genreMap.js';

const db = JSON.parse(await readFile('db.json', 'utf8'));

let changed = 0;
for (const [id, artist] of Object.entries(db.artists)) {
  // Last.fm öncelikli (daha zengin veri)
  let tags = [];
  if (artist.lastfmTags?.length > 0) {
    tags = artist.lastfmTags;
  } else if (artist.spotifyGenres?.length > 0) {
    tags = artist.spotifyGenres.map(g => ({ name: g, count: 50 }));
  }

  if (tags.length === 0) continue;

  const newMacro = getArtistMacroGenres(tags);
  const oldMacro = artist.macroGenres || [];

  if (JSON.stringify(newMacro) !== JSON.stringify(oldMacro)) {
    artist.macroGenres = newMacro.length > 0 ? newMacro : ['Unknown'];
    changed++;
  }
}

// Recompute timeline for all users
for (const userId of Object.keys(db.likedSongs)) {
  const songs = db.likedSongs[userId] || [];
  const yearMap = {};

  for (const song of songs) {
    const year = new Date(song.addedAt).getFullYear();
    if (!yearMap[year]) yearMap[year] = { songs: [], genres: {} };
    yearMap[year].songs.push(song);

    for (const artistId of song.artistIds) {
      const artist = db.artists[artistId];
      if (!artist) continue;
      for (const genre of artist.macroGenres) {
        yearMap[year].genres[genre] = (yearMap[year].genres[genre] || 0) + 1;
      }
    }
  }

  const years = Object.entries(yearMap)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([year, data]) => {
      const sorted = data.songs.sort((a, b) => new Date(a.addedAt) - new Date(b.addedAt));
      const artistCount = {};
      for (const s of data.songs) {
        for (const aid of s.artistIds) {
          const name = db.artists[aid]?.name || 'Unknown';
          artistCount[name] = (artistCount[name] || 0) + 1;
        }
      }
      const topArtists = Object.entries(artistCount)
        .sort((a, b) => b[1] - a[1]).slice(0, 5)
        .map(([name, count]) => ({ name, count }));

      return {
        year: parseInt(year),
        totalLikes: data.songs.length,
        genres: data.genres,
        topArtists,
        firstLike: sorted[0] ? {
          track: sorted[0].name,
          artist: db.artists[sorted[0].artistIds[0]]?.name,
          date: sorted[0].addedAt?.split('T')[0]
        } : null,
        lastLike: sorted.at(-1) ? {
          track: sorted.at(-1).name,
          artist: db.artists[sorted.at(-1).artistIds[0]]?.name,
          date: sorted.at(-1).addedAt?.split('T')[0]
        } : null
      };
    });

  const allSongs = songs.sort((a, b) => new Date(a.addedAt) - new Date(b.addedAt));
  db.timeline[userId] = {
    generatedAt: new Date().toISOString(),
    years,
    summary: {
      totalTracks: songs.length,
      firstLikeDate: allSongs[0]?.addedAt?.split('T')[0] || null,
      lastLikeDate: allSongs.at(-1)?.addedAt?.split('T')[0] || null
    }
  };
}

await writeFile('db.json', JSON.stringify(db, null, 2));
console.log(`Recalculated ${changed} artists`);

// Kontrol
const checkNames = ['Duman', 'Cem Karaca', 'Barış Manço', 'mor ve ötesi', 'Yüzyüzeyken Konuşuruz', 'Tarkan', 'Depeche Mode'];
for (const name of checkNames) {
  const a = Object.values(db.artists).find(x => x.name === name);
  if (a) console.log(`  ${a.name} -> ${a.macroGenres.join(', ')}`);
}
