# SoundShift

Spotify'da beğendiğin şarkıların genre evrimini görselleştiren web uygulaması.

## Ne yapıyor?

Spotify liked songs'larını çekip yıl yıl hangi genre'ları dinlediğini gösteriyor. Stacked area chart ile genre değişimini takip edebiliyorsun. Sosyal medyada paylaşımlık görsel de oluşturabiliyorsun.

## Tech Stack

- **Frontend:** React + Vite + Recharts
- **Backend:** Node.js + Express
- **Database:** Supabase (PostgreSQL)
- **Genre Data:** Last.fm + Spotify + MusicBrainz

## Kurulum

### 1. Gereksinimler

- Node.js 18+
- Spotify Developer hesabı
- Last.fm API key
- Supabase hesabı (ücretsiz)

### 2. Supabase Setup

Supabase'de yeni proje oluştur. SQL Editor'de `supabase-schema.sql` dosyasını çalıştır.

### 3. Spotify Dashboard

[developer.spotify.com](https://developer.spotify.com/dashboard) adresinden app oluştur.

Redirect URI ekle: `http://127.0.0.1:3001/auth/callback`

### 4. Environment Variables

```bash
cp .env.example .env
```

`.env` dosyasını doldur:

```
SPOTIFY_CLIENT_ID=...
SPOTIFY_SECRET_KEY=...
LASTFM_API_KEY=...
REDIRECT_URI=http://127.0.0.1:3001/auth/callback
FRONTEND_URL=http://127.0.0.1:5173
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
```

### 5. Çalıştır

```bash
npm install
cd client && npm install && cd ..
npm run dev
```

Tarayıcıda `http://127.0.0.1:5173` aç.

## Deploy (Render)

1. GitHub'a push'la
2. [render.com](https://render.com) → New Web Service → repo bağla
3. `render.yaml` otomatik algılanır
4. Environment variables ekle (production URL'lerle)
5. Spotify Dashboard'a production redirect URI ekle

## Lisans

MIT
