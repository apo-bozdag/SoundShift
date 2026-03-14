// Composite tag'ler önce kontrol edilir (specific patterns first)
// "anatolian rock" -> Rock, "turkish pop" -> Pop, "indie pop" -> Indie
// Milliyet genre değildir, müzik tarzı genre'dır.

const COMPOSITE_RULES = [
  // Rock composite'leri
  { macro: 'Rock', patterns: ['anatolian rock', 'turkish rock', 'turkish metal',
    'classic rock', 'hard rock', 'soft rock', 'pop rock', 'punk rock',
    'post-punk', 'garage rock', 'progressive rock', 'psychedelic rock',
    'stoner rock', 'southern rock', 'glam rock'] },
  // Indie composite'leri
  { macro: 'Indie', patterns: ['indie pop', 'indie rock', 'indie folk',
    'indie electronic', 'art pop', 'dream pop', 'chamber pop', 'baroque pop',
    'noise pop', 'art rock'] },
  // Electronic composite'leri
  { macro: 'Electronic', patterns: ['synthpop', 'synth-pop', 'electropop',
    'dance pop', 'europop', 'new wave', 'darkwave', 'italo disco', 'disco',
    'neue deutsche welle'] },
  // Folk composite'leri
  { macro: 'Folk', patterns: ['turkish folk', 'anatolian folk', 'karadeniz folk',
    'karadeniz', 'folk rock', 'folk pop', 'folk metal'] },
  // Pop composite'leri (turkish pop, t-pop dahil — türü pop olan pop'tur)
  { macro: 'Pop', patterns: ['turkish pop', 'anatolian pop', 't-pop',
    'turk pop', 'dansktop', 'dansk pop'] },
  // Arabesk/Halk -> kendi kategorisi veya World
  { macro: 'World', patterns: ['arabesk', 'arabesque', 'oyun havası',
    'türkü', 'turku'] },
];

// Genel keyword map
const GENRE_MAP = {
  'Hip-Hop':     ['hip hop', 'rap', 'trap', 'drill', 'grime', 'phonk', 'boom bap'],
  'Electronic':  ['electronic', 'edm', 'house', 'techno', 'trance', 'dubstep',
                  'drum and bass', 'ambient', 'synthwave'],
  'Rock':        ['rock', 'punk', 'grunge', 'metal', 'emo', 'hardcore',
                  'shoegaze', 'psychedelic'],
  'R&B/Soul':    ['r&b', 'rnb', 'soul', 'funk', 'neo soul', 'motown'],
  'Indie':       ['indie', 'alternative', 'lo-fi', 'post-rock'],
  'Pop':         ['pop', 'k-pop', 'j-pop'],
  'Latin':       ['latin', 'reggaeton', 'salsa', 'bachata', 'cumbia'],
  'Jazz':        ['jazz', 'bebop', 'swing', 'bossa nova'],
  'Classical':   ['classical', 'baroque', 'opera', 'orchestral'],
  'Folk':        ['folk', 'singer-songwriter', 'acoustic', 'celtic'],
  'Country':     ['country', 'bluegrass', 'americana'],
  'Blues':       ['blues'],
  'Reggae':      ['reggae', 'ska', 'dancehall', 'dub'],
  'World':       ['afrobeat', 'african', 'indian', 'arabic', 'world']
};

export function normalizeGenre(microGenre) {
  const lower = microGenre.toLowerCase().trim();

  // 1. Composite rules (specific patterns first)
  for (const rule of COMPOSITE_RULES) {
    if (rule.patterns.some(p => lower.includes(p))) return rule.macro;
  }

  // 2. General keyword match
  for (const [macro, keywords] of Object.entries(GENRE_MAP)) {
    if (keywords.some(kw => lower.includes(kw))) return macro;
  }

  return 'Other';
}

// Bir artist'in tüm tag'lerinden dominant macro genre'ları çıkar
export function getArtistMacroGenres(tags) {
  const counts = {};
  for (const tag of tags) {
    const macro = normalizeGenre(tag.name || tag);
    const weight = tag.count || 1;
    counts[macro] = (counts[macro] || 0) + weight;
  }

  return Object.entries(counts)
    .filter(([genre]) => genre !== 'Other')
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([genre]) => genre);
}
