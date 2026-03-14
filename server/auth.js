import { Router } from 'express';
import crypto from 'crypto';
import supabase from './db.js';

const router = Router();
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_SECRET_KEY;
const REDIRECT_URI = process.env.REDIRECT_URI;
const SCOPES = 'user-library-read user-read-private';

// Geçici code_verifier store (memory, login başına)
const pendingAuth = new Map();

// Eski state'leri temizle (10 dk TTL)
setInterval(() => {
  const tenMinAgo = Date.now() - 10 * 60 * 1000;
  for (const [state, data] of pendingAuth) {
    if (data.createdAt < tenMinAgo) pendingAuth.delete(state);
  }
}, 60 * 1000);

router.get('/login', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');

  pendingAuth.set(state, { codeVerifier, createdAt: Date.now() });

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    scope: SCOPES,
    redirect_uri: REDIRECT_URI,
    state,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge
  });

  res.json({ url: `https://accounts.spotify.com/authorize?${params}` });
});

router.get('/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      return res.redirect(`${process.env.FRONTEND_URL}?error=${error}`);
    }

    const pending = pendingAuth.get(state);
    if (!pending) {
      return res.redirect(`${process.env.FRONTEND_URL}?error=invalid_state`);
    }
    pendingAuth.delete(state);

    // Token exchange
    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        code_verifier: pending.codeVerifier
      })
    });

    const tokens = await tokenRes.json();
    if (tokens.error) {
      return res.redirect(`${process.env.FRONTEND_URL}?error=${tokens.error}`);
    }

    // Kullanıcı bilgisi al
    const profileRes = await fetch('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });
    const profile = await profileRes.json();

    // Mevcut kullanıcıyı kontrol et (last_sync_at/last_added_at koru)
    const { data: existing } = await supabase
      .from('users')
      .select('last_sync_at, last_added_at')
      .eq('spotify_id', profile.id)
      .single();

    await supabase.from('users').upsert({
      spotify_id: profile.id,
      display_name: profile.display_name,
      profile_image: profile.images?.[0]?.url || null,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: Date.now() + tokens.expires_in * 1000,
      last_sync_at: existing?.last_sync_at || null,
      last_added_at: existing?.last_added_at || null
    });

    // User ID'yi httpOnly cookie'ye koy
    res.cookie('spotify_user_id', profile.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 365 * 24 * 60 * 60 * 1000
    });

    // Refresh token'ı da httpOnly cookie'ye koy
    res.cookie('spotify_refresh', tokens.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 365 * 24 * 60 * 60 * 1000
    });

    res.redirect(process.env.FRONTEND_URL);
  } catch (err) {
    console.error('Auth callback error:', err);
    res.redirect(`${process.env.FRONTEND_URL}?error=server_error`);
  }
});

router.get('/refresh', async (req, res) => {
  try {
    const userId = req.cookies.spotify_user_id;
    const refreshToken = req.cookies.spotify_refresh;
    if (!userId || !refreshToken) {
      return res.status(401).json({ error: 'No session' });
    }

    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: CLIENT_ID
      })
    });

    const tokens = await tokenRes.json();
    if (tokens.error) {
      return res.status(400).json({ error: tokens.error });
    }

    // DB güncelle
    const updates = {
      access_token: tokens.access_token,
      token_expires_at: Date.now() + tokens.expires_in * 1000,
    };
    if (tokens.refresh_token) updates.refresh_token = tokens.refresh_token;

    await supabase.from('users').update(updates).eq('spotify_id', userId);

    // Yeni refresh token geldiyse cookie'yi güncelle
    if (tokens.refresh_token) {
      res.cookie('spotify_refresh', tokens.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 365 * 24 * 60 * 60 * 1000
      });
    }

    res.json({
      accessToken: tokens.access_token,
      expiresIn: tokens.expires_in
    });
  } catch (err) {
    console.error('Token refresh error:', err);
    res.status(500).json({ error: 'Refresh failed' });
  }
});

router.get('/me', async (req, res) => {
  const userId = req.cookies.spotify_user_id;
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  const { data: user } = await supabase
    .from('users')
    .select('spotify_id, display_name, profile_image, last_sync_at')
    .eq('spotify_id', userId)
    .single();

  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  res.json({
    id: user.spotify_id,
    displayName: user.display_name,
    profileImage: user.profile_image,
    lastSyncAt: user.last_sync_at
  });
});

router.post('/logout', (req, res) => {
  res.clearCookie('spotify_user_id');
  res.clearCookie('spotify_refresh');
  res.json({ ok: true });
});

export default router;

// Auth middleware
export async function requireAuth(req, res, next) {
  try {
    const userId = req.cookies.spotify_user_id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('spotify_id', userId)
      .single();

    if (!user) return res.status(401).json({ error: 'Not authenticated' });

    req.userId = userId;
    req.user = user;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    res.status(500).json({ error: 'Auth check failed' });
  }
}

// Token'ı gerekirse refresh et, access token döndür
export async function getValidToken(userId) {
  const { data: user } = await supabase
    .from('users')
    .select('access_token, refresh_token, token_expires_at')
    .eq('spotify_id', userId)
    .single();

  if (!user) throw new Error('User not found');

  // Token 5 dk içinde expire olacaksa refresh et
  if (user.token_expires_at < Date.now() + 5 * 60 * 1000) {
    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: user.refresh_token,
        client_id: CLIENT_ID
      })
    });

    const tokens = await tokenRes.json();
    if (tokens.error) throw new Error(`Token refresh failed: ${tokens.error}`);

    const updates = {
      access_token: tokens.access_token,
      token_expires_at: Date.now() + tokens.expires_in * 1000,
    };
    if (tokens.refresh_token) updates.refresh_token = tokens.refresh_token;

    await supabase.from('users').update(updates).eq('spotify_id', userId);
    return tokens.access_token;
  }

  return user.access_token;
}
