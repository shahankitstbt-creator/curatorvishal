const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'socialfeed_secret_change_in_production';

// ─── DATABASE ────────────────────────────────────────────────────────────────
const DB_FILE = path.join(__dirname, 'database.json');
function loadDB() {
  if (fs.existsSync(DB_FILE)) {
    try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch(e) {}
  }
  return { users:[], feeds:[], sources:[], posts:[], credentials:[] };
}
function saveDB() { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); }
let db = loadDB();
if (!db.credentials) db.credentials = [];

if (!db.users.length) {
  db.users.push({ id: uuidv4(), email: 'admin@socialfeed.com',
    password: bcrypt.hashSync('admin123', 10), name: 'Admin', role: 'admin',
    createdAt: new Date().toISOString() });
  saveDB();
}

// ─── LOAD .env ───────────────────────────────────────────────────────────────
const envFile = path.join(__dirname, '../.env');
if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, 'utf8').split('\n').forEach(line => {
    const eq = line.indexOf('=');
    if (eq > 0 && !line.startsWith('#')) {
      const k = line.substring(0, eq).trim();
      const v = line.substring(eq + 1).trim().replace(/^["']|["']$/g, '');
      process.env[k] = v;
    }
  });
}

// ─── OAUTH PLATFORM CONFIG ────────────────────────────────────────────────────
const PLATFORM_OAUTH = {
  instagram: {
    name: 'Instagram', color: '#E4405F',
    authUrl: 'https://api.instagram.com/oauth/authorize',
    tokenUrl: 'https://api.instagram.com/oauth/access_token',
    scope: 'user_profile,user_media',
    envClientId: 'INSTAGRAM_CLIENT_ID',
    envClientSecret: 'INSTAGRAM_CLIENT_SECRET',
  },
  facebook: {
    name: 'Facebook', color: '#1877F2',
    authUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v19.0/oauth/access_token',
    scope: 'pages_read_engagement,pages_show_list',
    envClientId: 'FACEBOOK_APP_ID',
    envClientSecret: 'FACEBOOK_APP_SECRET',
  },
  youtube: {
    name: 'YouTube', color: '#FF0000',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'https://www.googleapis.com/auth/youtube.readonly',
    envClientId: 'YOUTUBE_CLIENT_ID',
    envClientSecret: 'YOUTUBE_CLIENT_SECRET',
  },
  twitter: {
    name: 'X / Twitter', color: '#000000',
    authUrl: 'https://twitter.com/i/oauth2/authorize',
    tokenUrl: 'https://api.twitter.com/2/oauth2/token',
    scope: 'tweet.read users.read offline.access',
    envClientId: 'TWITTER_CLIENT_ID',
    envClientSecret: 'TWITTER_CLIENT_SECRET',
    envBearerToken: 'TWITTER_BEARER_TOKEN',
  },
  linkedin: {
    name: 'LinkedIn', color: '#0A66C2',
    authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    scope: 'r_liteprofile r_emailaddress',
    envClientId: 'LINKEDIN_CLIENT_ID',
    envClientSecret: 'LINKEDIN_CLIENT_SECRET',
  },
  reddit: {
    name: 'Reddit', color: '#FF4500',
    authUrl: 'https://www.reddit.com/api/v1/authorize',
    tokenUrl: 'https://www.reddit.com/api/v1/access_token',
    scope: 'identity read',
    envClientId: 'REDDIT_CLIENT_ID',
    envClientSecret: 'REDDIT_CLIENT_SECRET',
  },
  tiktok: {
    name: 'TikTok', color: '#010101',
    authUrl: 'https://www.tiktok.com/v2/auth/authorize/',
    tokenUrl: 'https://open.tiktokapis.com/v2/oauth/token/',
    scope: 'user.info.basic,video.list',
    envClientId: 'TIKTOK_CLIENT_KEY',
    envClientSecret: 'TIKTOK_CLIENT_SECRET',
  },
};

function getCreds(platform, userId) {
  const cfg = { ...PLATFORM_OAUTH[platform] };
  // Apply env defaults
  if (cfg.envClientId) cfg.clientId = process.env[cfg.envClientId] || '';
  if (cfg.envClientSecret) cfg.clientSecret = process.env[cfg.envClientSecret] || '';
  if (cfg.envBearerToken) cfg.bearerToken = process.env[cfg.envBearerToken] || '';
  // Override with user-stored credentials (takes priority)
  const stored = db.credentials.find(c => c.userId === userId && c.platform === platform);
  if (stored) {
    if (stored.clientId) cfg.clientId = stored.clientId;
    if (stored.clientSecret) cfg.clientSecret = stored.clientSecret;
    if (stored.bearerToken) cfg.bearerToken = stored.bearerToken;
  }
  return cfg;
}

function getBaseUrl(req) {
  return process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
}

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
app.use(cors({ origin: '*', methods: ['GET','POST','PUT','DELETE','OPTIONS'] }));
app.options('*', cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../curator/frontend')));

function authMiddleware(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Invalid token' }); }
}

// ─── AUTH ROUTES ──────────────────────────────────────────────────────────────
app.post('/api/auth/login', (req, res) => {
  const user = db.users.find(u => u.email === req.body.email);
  if (!user || !bcrypt.compareSync(req.body.password, user.password))
    return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

app.post('/api/auth/register', (req, res) => {
  if (db.users.find(u => u.email === req.body.email))
    return res.status(400).json({ error: 'Email already exists' });
  const user = { id: uuidv4(), email: req.body.email,
    password: bcrypt.hashSync(req.body.password, 10),
    name: req.body.name, role: 'user', createdAt: new Date().toISOString() };
  db.users.push(user);
  saveDB();
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  const user = db.users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ id: user.id, email: user.email, name: user.name, role: user.role });
});

// ─── CREDENTIALS (per-platform app keys) ─────────────────────────────────────
app.get('/api/credentials', authMiddleware, (req, res) => {
  const creds = db.credentials.filter(c => c.userId === req.user.id);
  res.json(creds.map(c => ({
    platform: c.platform,
    clientId: c.clientId ? c.clientId.substring(0, 8) + '...' : '',
    hasSecret: !!c.clientSecret,
    hasBearerToken: !!c.bearerToken,
  })));
});

app.post('/api/credentials', authMiddleware, (req, res) => {
  const { platform, clientId, clientSecret, bearerToken } = req.body;
  const idx = db.credentials.findIndex(c => c.userId === req.user.id && c.platform === platform);
  const cred = { userId: req.user.id, platform, clientId: clientId||'', clientSecret: clientSecret||'', bearerToken: bearerToken||'' };
  if (idx >= 0) db.credentials[idx] = cred;
  else db.credentials.push(cred);
  saveDB();
  res.json({ success: true, message: `${platform} credentials saved` });
});

// ─── OAUTH: START (opens in popup) ───────────────────────────────────────────
app.get('/oauth/start/:platform', (req, res) => {
  const platform = req.params.platform;
  const { feedId, type, userId } = req.query;
  const cfg = getCreds(platform, userId);
  const baseUrl = getBaseUrl(req);
  const redirectUri = `${baseUrl}/oauth/callback/${platform}`;

  if (!cfg.clientId) {
    return res.send(credsMissingPage(platform, cfg.name));
  }

  const state = Buffer.from(JSON.stringify({ userId, feedId, type: type||'profile', ts: Date.now() })).toString('base64');

  let authUrl = '';
  switch (platform) {
    case 'instagram':
      authUrl = `${cfg.authUrl}?client_id=${cfg.clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${cfg.scope}&response_type=code&state=${state}`;
      break;
    case 'facebook':
      authUrl = `${cfg.authUrl}?client_id=${cfg.clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${cfg.scope}&response_type=code&state=${state}`;
      break;
    case 'youtube':
      authUrl = `${cfg.authUrl}?client_id=${cfg.clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(cfg.scope)}&response_type=code&access_type=offline&prompt=consent&state=${state}`;
      break;
    case 'twitter': {
      const verifier = Buffer.from(uuidv4()).toString('base64').replace(/[^a-zA-Z0-9]/g,'').substring(0,43);
      if (!db._pkce) db._pkce = {};
      db._pkce[state] = verifier;
      authUrl = `${cfg.authUrl}?response_type=code&client_id=${cfg.clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(cfg.scope)}&state=${state}&code_challenge=${verifier}&code_challenge_method=plain`;
      break;
    }
    case 'linkedin':
      authUrl = `${cfg.authUrl}?response_type=code&client_id=${cfg.clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(cfg.scope)}&state=${state}`;
      break;
    case 'reddit':
      authUrl = `${cfg.authUrl}?client_id=${cfg.clientId}&response_type=code&state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}&duration=permanent&scope=${encodeURIComponent(cfg.scope)}`;
      break;
    case 'tiktok':
      authUrl = `${cfg.authUrl}?client_key=${cfg.clientId}&response_type=code&scope=${encodeURIComponent(cfg.scope)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
      break;
    default:
      return res.status(400).send('Unknown platform');
  }

  res.redirect(authUrl);
});

// ─── OAUTH: CALLBACK ──────────────────────────────────────────────────────────
app.get('/oauth/callback/:platform', async (req, res) => {
  const platform = req.params.platform;
  const { code, state, error, error_description } = req.query;

  if (error) return res.send(oauthDonePage(false, platform, error_description || error));
  if (!code) return res.send(oauthDonePage(false, platform, 'No authorization code received'));

  let stateData;
  try { stateData = JSON.parse(Buffer.from(state || '', 'base64').toString()); }
  catch { return res.send(oauthDonePage(false, platform, 'Invalid state parameter')); }

  const { userId, feedId, type } = stateData;
  const cfg = getCreds(platform, userId);
  const baseUrl = getBaseUrl(req);
  const redirectUri = `${baseUrl}/oauth/callback/${platform}`;

  try {
    const tokenData = await exchangeToken(platform, code, cfg, redirectUri, state);
    if (!tokenData || tokenData.error) {
      throw new Error(tokenData?.error_description || tokenData?.error || 'Token exchange failed');
    }

    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token || '';
    const profile = await getProfile(platform, accessToken);

    const source = {
      id: uuidv4(), feedId, userId, platform,
      type: type || 'profile',
      handle: profile.handle || '',
      displayName: profile.name || '',
      avatar: profile.avatar || '',
      accessToken,
      refreshToken,
      platformUserId: profile.id || '',
      status: 'connected',
      lastSync: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    db.sources.push(source);
    saveDB();

    // Fetch real posts right away
    try { await syncPosts(source); } catch(e) { console.warn('Initial sync warn:', e.message); }

    return res.send(oauthDonePage(true, platform, null, profile));
  } catch (err) {
    console.error(`[${platform}] OAuth error:`, err.message);
    return res.send(oauthDonePage(false, platform, err.message));
  }
});

// Manual token (for YouTube API key or others)
app.post('/api/oauth/manual', authMiddleware, async (req, res) => {
  const { platform, accessToken, feedId, type } = req.body;
  if (!accessToken || !platform || !feedId)
    return res.status(400).json({ error: 'platform, accessToken, feedId required' });
  try {
    const profile = await getProfile(platform, accessToken);
    const source = {
      id: uuidv4(), feedId, userId: req.user.id, platform,
      type: type || 'profile',
      handle: profile.handle || '',
      displayName: profile.name || '',
      avatar: profile.avatar || '',
      accessToken,
      refreshToken: '',
      platformUserId: profile.id || '',
      status: 'connected',
      lastSync: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    db.sources.push(source);
    saveDB();
    await syncPosts(source);
    res.json({ success: true, source: { ...source, accessToken: '***' }, profile });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Sync posts for a source
app.post('/api/feeds/:feedId/sources/:sourceId/sync', authMiddleware, async (req, res) => {
  const source = db.sources.find(s => s.id === req.params.sourceId && s.feedId === req.params.feedId);
  if (!source) return res.status(404).json({ error: 'Source not found' });
  try {
    const added = await syncPosts(source);
    res.json({ success: true, newPosts: added });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── TOKEN EXCHANGE ───────────────────────────────────────────────────────────
async function exchangeToken(platform, code, cfg, redirectUri, state) {
  switch (platform) {
    case 'instagram': {
      const f = new URLSearchParams({ client_id:cfg.clientId, client_secret:cfg.clientSecret, grant_type:'authorization_code', redirect_uri:redirectUri, code });
      return (await fetch(cfg.tokenUrl, { method:'POST', body:f })).json();
    }
    case 'facebook': {
      const url = `${cfg.tokenUrl}?client_id=${cfg.clientId}&client_secret=${cfg.clientSecret}&code=${code}&redirect_uri=${encodeURIComponent(redirectUri)}`;
      return (await fetch(url)).json();
    }
    case 'youtube': {
      const f = new URLSearchParams({ code, client_id:cfg.clientId, client_secret:cfg.clientSecret, redirect_uri:redirectUri, grant_type:'authorization_code' });
      return (await fetch(cfg.tokenUrl, { method:'POST', body:f })).json();
    }
    case 'twitter': {
      const verifier = db._pkce?.[state] || '';
      const creds = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64');
      const f = new URLSearchParams({ code, grant_type:'authorization_code', redirect_uri:redirectUri, code_verifier:verifier });
      return (await fetch(cfg.tokenUrl, { method:'POST', body:f, headers:{ Authorization:`Basic ${creds}`, 'Content-Type':'application/x-www-form-urlencoded' } })).json();
    }
    case 'linkedin': {
      const f = new URLSearchParams({ grant_type:'authorization_code', code, redirect_uri:redirectUri, client_id:cfg.clientId, client_secret:cfg.clientSecret });
      return (await fetch(cfg.tokenUrl, { method:'POST', body:f, headers:{'Content-Type':'application/x-www-form-urlencoded'} })).json();
    }
    case 'reddit': {
      const creds = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64');
      const f = new URLSearchParams({ grant_type:'authorization_code', code, redirect_uri:redirectUri });
      return (await fetch(cfg.tokenUrl, { method:'POST', body:f, headers:{ Authorization:`Basic ${creds}`, 'Content-Type':'application/x-www-form-urlencoded', 'User-Agent':'SocialFeed/1.0' } })).json();
    }
    case 'tiktok': {
      const f = new URLSearchParams({ client_key:cfg.clientId, client_secret:cfg.clientSecret, code, grant_type:'authorization_code', redirect_uri:redirectUri });
      const d = await (await fetch(cfg.tokenUrl, { method:'POST', body:f, headers:{'Content-Type':'application/x-www-form-urlencoded'} })).json();
      return d.data || d;
    }
    default: throw new Error('Unknown platform: ' + platform);
  }
}

// ─── FETCH USER PROFILE ───────────────────────────────────────────────────────
async function getProfile(platform, token) {
  switch (platform) {
    case 'instagram': {
      const d = await (await fetch(`https://graph.instagram.com/me?fields=id,username&access_token=${token}`)).json();
      if (d.error) throw new Error(d.error.message);
      return { id:d.id, handle:'@'+d.username, name:d.username, username:d.username };
    }
    case 'facebook': {
      const d = await (await fetch(`https://graph.facebook.com/me?fields=id,name,picture.width(200)&access_token=${token}`)).json();
      if (d.error) throw new Error(d.error.message);
      return { id:d.id, handle:d.name, name:d.name, avatar:d.picture?.data?.url||'' };
    }
    case 'youtube': {
      const d = await (await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', { headers:{Authorization:`Bearer ${token}`} })).json();
      if (d.error) throw new Error(d.error.message);
      const ch = d.items?.[0]; if (!ch) throw new Error('No YouTube channel found');
      return { id:ch.id, handle:ch.snippet.title, name:ch.snippet.title, avatar:ch.snippet.thumbnails?.default?.url||'' };
    }
    case 'twitter': {
      const d = await (await fetch('https://api.twitter.com/2/users/me?user.fields=profile_image_url,name,username', { headers:{Authorization:`Bearer ${token}`} })).json();
      if (d.errors) throw new Error(d.errors[0].message);
      return { id:d.data?.id, handle:'@'+d.data?.username, name:d.data?.name, avatar:d.data?.profile_image_url||'' };
    }
    case 'linkedin': {
      const d = await (await fetch('https://api.linkedin.com/v2/me', { headers:{Authorization:`Bearer ${token}`} })).json();
      if (d.message) throw new Error(d.message);
      return { id:d.id, handle:`${d.localizedFirstName} ${d.localizedLastName}`, name:`${d.localizedFirstName} ${d.localizedLastName}` };
    }
    case 'reddit': {
      const d = await (await fetch('https://oauth.reddit.com/api/v1/me', { headers:{Authorization:`Bearer ${token}`, 'User-Agent':'SocialFeed/1.0'} })).json();
      if (d.error) throw new Error(d.message || String(d.error));
      return { id:d.id, handle:'u/'+d.name, name:d.name, avatar:d.icon_img?.split('?')[0]||'' };
    }
    case 'tiktok': {
      const d = await (await fetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url', { headers:{Authorization:`Bearer ${token}`} })).json();
      if (d.error?.code !== 'ok') throw new Error(d.error?.message || 'Profile fetch failed');
      const u = d.data?.user;
      return { id:u?.open_id, handle:u?.display_name, name:u?.display_name, avatar:u?.avatar_url||'' };
    }
    default: return { handle:platform, name:platform };
  }
}

// ─── REAL POST SYNC ───────────────────────────────────────────────────────────
async function syncPosts(source) {
  let rawPosts = [];
  switch (source.platform) {
    case 'instagram': rawPosts = await fetchInstagram(source); break;
    case 'facebook':  rawPosts = await fetchFacebook(source);  break;
    case 'youtube':   rawPosts = await fetchYouTube(source);   break;
    case 'twitter':   rawPosts = await fetchTwitter(source);   break;
    case 'linkedin':  rawPosts = await fetchLinkedIn(source);  break;
    case 'reddit':    rawPosts = await fetchReddit(source);    break;
    case 'tiktok':    rawPosts = await fetchTikTok(source);    break;
    default: return 0;
  }

  let added = 0;
  for (const p of rawPosts) {
    if (!db.posts.find(x => x.externalId === p.externalId && x.feedId === source.feedId)) {
      db.posts.push({
        ...p, id: uuidv4(), feedId: source.feedId, sourceId: source.id,
        platform: source.platform, published: true, pinned: false,
        createdAt: new Date().toISOString(),
      });
      added++;
    }
  }
  source.lastSync = new Date().toISOString();
  saveDB();
  return added;
}

async function fetchInstagram(s) {
  const url = `https://graph.instagram.com/me/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count&access_token=${s.accessToken}&limit=30`;
  const d = await (await fetch(url)).json();
  if (d.error) throw new Error('Instagram: ' + d.error.message);
  return (d.data||[]).map(p => ({
    externalId: 'ig_'+p.id, username:s.handle, displayName:s.displayName, avatar:s.avatar,
    content: p.caption||'', media: p.media_type==='VIDEO'?[p.thumbnail_url||'']:[p.media_url||''],
    url: p.permalink, likes: p.like_count||0, comments: p.comments_count||0, shares:0,
    publishedAt: p.timestamp,
  }));
}

async function fetchFacebook(s) {
  const url = `https://graph.facebook.com/me/posts?fields=id,message,full_picture,permalink_url,created_time,reactions.summary(true),comments.summary(true)&access_token=${s.accessToken}&limit=30`;
  const d = await (await fetch(url)).json();
  if (d.error) throw new Error('Facebook: ' + d.error.message);
  return (d.data||[]).map(p => ({
    externalId: 'fb_'+p.id, username:s.handle, displayName:s.displayName, avatar:s.avatar,
    content: p.message||'', media: p.full_picture?[p.full_picture]:[],
    url: p.permalink_url||'#', likes: p.reactions?.summary?.total_count||0,
    comments: p.comments?.summary?.total_count||0, shares:0, publishedAt: p.created_time,
  }));
}

async function fetchYouTube(s) {
  // Get uploads playlist
  const chRes = await fetch('https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true', { headers:{Authorization:`Bearer ${s.accessToken}`} });
  const chData = await chRes.json();
  if (chData.error) throw new Error('YouTube: ' + chData.error.message);
  const uploadsId = chData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsId) throw new Error('YouTube: No uploads playlist found');

  const plRes = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploadsId}&maxResults=30`, { headers:{Authorization:`Bearer ${s.accessToken}`} });
  const plData = await plRes.json();
  if (plData.error) throw new Error('YouTube: ' + plData.error.message);

  const ids = (plData.items||[]).map(i=>i.contentDetails.videoId).join(',');
  const statsRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${ids}`, { headers:{Authorization:`Bearer ${s.accessToken}`} });
  const statsData = await statsRes.json();
  const statsMap = {};
  (statsData.items||[]).forEach(v => statsMap[v.id]=v.statistics);

  return (plData.items||[]).map(item => {
    const sn = item.snippet, vid = item.contentDetails.videoId, st = statsMap[vid]||{};
    return {
      externalId: 'yt_'+vid, username:s.handle, displayName:s.displayName, avatar:s.avatar,
      content: sn.title + (sn.description?'\n\n'+sn.description.substring(0,200):''),
      media: [sn.thumbnails?.high?.url||sn.thumbnails?.default?.url||''],
      url: `https://www.youtube.com/watch?v=${vid}`,
      likes: parseInt(st.likeCount)||0, comments: parseInt(st.commentCount)||0, shares:0,
      publishedAt: sn.publishedAt,
    };
  });
}

async function fetchTwitter(s) {
  const meRes = await fetch('https://api.twitter.com/2/users/me', { headers:{Authorization:`Bearer ${s.accessToken}`} });
  const me = await meRes.json();
  if (me.errors) throw new Error('Twitter: ' + me.errors[0].message);

  const tweetsRes = await fetch(
    `https://api.twitter.com/2/users/${me.data.id}/tweets?tweet.fields=created_at,public_metrics,attachments&expansions=attachments.media_keys&media.fields=url,preview_image_url&max_results=20`,
    { headers:{Authorization:`Bearer ${s.accessToken}`} }
  );
  const d = await tweetsRes.json();
  if (d.errors) throw new Error('Twitter: ' + d.errors[0].message);

  const mediaMap = {};
  (d.includes?.media||[]).forEach(m => mediaMap[m.media_key]=m.url||m.preview_image_url||'');

  return (d.data||[]).map(t => ({
    externalId: 'tw_'+t.id, username:s.handle, displayName:s.displayName, avatar:s.avatar,
    content: t.text, media: (t.attachments?.media_keys||[]).map(k=>mediaMap[k]).filter(Boolean),
    url: `https://twitter.com/i/web/status/${t.id}`,
    likes: t.public_metrics?.like_count||0, comments: t.public_metrics?.reply_count||0,
    shares: t.public_metrics?.retweet_count||0, publishedAt: t.created_at,
  }));
}

async function fetchLinkedIn(s) {
  const d = await (await fetch(
    `https://api.linkedin.com/v2/ugcPosts?q=authors&authors=List(${encodeURIComponent('urn:li:person:'+s.platformUserId)})&count=20`,
    { headers:{Authorization:`Bearer ${s.accessToken}`, 'X-Restli-Protocol-Version':'2.0.0'} }
  )).json();
  if (d.message) throw new Error('LinkedIn: ' + d.message);
  return (d.elements||[]).map(p => ({
    externalId: 'li_'+p.id, username:s.handle, displayName:s.displayName, avatar:s.avatar,
    content: p.specificContent?.['com.linkedin.ugc.ShareContent']?.shareCommentary?.text||'',
    media: [], url: `https://www.linkedin.com/feed/update/${p.id}`,
    likes: 0, comments: 0, shares: 0,
    publishedAt: new Date(p.created?.time||Date.now()).toISOString(),
  }));
}

async function fetchReddit(s) {
  const username = (s.handle||'').replace('u/','');
  const d = await (await fetch(
    `https://oauth.reddit.com/user/${username}/submitted?limit=25`,
    { headers:{Authorization:`Bearer ${s.accessToken}`, 'User-Agent':'SocialFeed/1.0'} }
  )).json();
  if (d.error) throw new Error('Reddit: ' + (d.message||d.error));
  return (d.data?.children||[]).map(({data:p}) => ({
    externalId: 'rd_'+p.id, username:'u/'+p.author, displayName:p.author, avatar:s.avatar,
    content: p.title+(p.selftext?'\n\n'+p.selftext.substring(0,300):''),
    media: p.thumbnail?.startsWith('http')?[p.thumbnail]:[],
    url: 'https://reddit.com'+p.permalink,
    likes: p.score||0, comments: p.num_comments||0, shares:0,
    publishedAt: new Date(p.created_utc*1000).toISOString(),
  }));
}

async function fetchTikTok(s) {
  const d = await (await fetch(
    'https://open.tiktokapis.com/v2/video/list/?fields=id,title,cover_image_url,share_url,create_time,like_count,comment_count,share_count',
    { method:'POST', body:JSON.stringify({max_count:20}), headers:{Authorization:`Bearer ${s.accessToken}`,'Content-Type':'application/json'} }
  )).json();
  if (d.error?.code !== 'ok') throw new Error('TikTok: ' + (d.error?.message||'Fetch failed'));
  return (d.data?.videos||[]).map(v => ({
    externalId: 'tt_'+v.id, username:s.handle, displayName:s.displayName, avatar:s.avatar,
    content: v.title||'', media: [v.cover_image_url||''],
    url: v.share_url||'#',
    likes: v.like_count||0, comments: v.comment_count||0, shares: v.share_count||0,
    publishedAt: new Date((v.create_time||0)*1000).toISOString(),
  }));
}

// ─── FEEDS CRUD ───────────────────────────────────────────────────────────────
app.get('/api/feeds', authMiddleware, (req, res) =>
  res.json(db.feeds.filter(f => f.userId === req.user.id)));

app.post('/api/feeds', authMiddleware, (req, res) => {
  const feed = {
    id: uuidv4(), userId: req.user.id, name: req.body.name,
    description: req.body.description||'', theme:'dark', layout:'grid',
    columns:3, gap:16, cardRadius:12, showAvatar:true, showUsername:true,
    showCaption:true, showPlatform:true, showDate:true, maxPosts:20,
    apiKey: uuidv4().replace(/-/g,''), published:false,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  db.feeds.push(feed); saveDB();
  res.json(feed);
});

app.put('/api/feeds/:id', authMiddleware, (req, res) => {
  const idx = db.feeds.findIndex(f => f.id===req.params.id && f.userId===req.user.id);
  if (idx<0) return res.status(404).json({ error:'Feed not found' });
  db.feeds[idx] = { ...db.feeds[idx], ...req.body, updatedAt:new Date().toISOString() };
  saveDB(); res.json(db.feeds[idx]);
});

app.delete('/api/feeds/:id', authMiddleware, (req, res) => {
  db.feeds = db.feeds.filter(f => !(f.id===req.params.id && f.userId===req.user.id));
  db.sources = db.sources.filter(s => s.feedId!==req.params.id);
  db.posts = db.posts.filter(p => p.feedId!==req.params.id);
  saveDB(); res.json({ success:true });
});

// ─── SOURCES CRUD ─────────────────────────────────────────────────────────────
app.get('/api/feeds/:feedId/sources', authMiddleware, (req, res) => {
  const feed = db.feeds.find(f => f.id===req.params.feedId && f.userId===req.user.id);
  if (!feed) return res.status(404).json({ error:'Feed not found' });
  res.json(db.sources.filter(s => s.feedId===req.params.feedId)
    .map(s => ({...s, accessToken: s.accessToken?'***':''})));
});

app.delete('/api/feeds/:feedId/sources/:sourceId', authMiddleware, (req, res) => {
  db.sources = db.sources.filter(s => s.id!==req.params.sourceId);
  db.posts   = db.posts.filter(p => p.sourceId!==req.params.sourceId);
  saveDB(); res.json({ success:true });
});

// ─── POSTS CRUD ───────────────────────────────────────────────────────────────
app.get('/api/feeds/:feedId/posts', authMiddleware, (req, res) => {
  const feed = db.feeds.find(f => f.id===req.params.feedId && f.userId===req.user.id);
  if (!feed) return res.status(404).json({ error:'Feed not found' });
  res.json(db.posts.filter(p => p.feedId===req.params.feedId));
});

app.post('/api/feeds/:feedId/posts', authMiddleware, (req, res) => {
  const post = {
    id: uuidv4(), feedId:req.params.feedId, sourceId:null,
    platform:req.body.platform, username:req.body.username, displayName:req.body.displayName,
    avatar:req.body.avatar||'', content:req.body.content, media:req.body.media||[],
    url:req.body.url||'', likes:req.body.likes||0, comments:req.body.comments||0,
    shares:req.body.shares||0, publishedAt:req.body.publishedAt||new Date().toISOString(),
    published:true, pinned:false, createdAt:new Date().toISOString(),
  };
  db.posts.push(post); saveDB(); res.json(post);
});

app.put('/api/feeds/:feedId/posts/:postId', authMiddleware, (req, res) => {
  const idx = db.posts.findIndex(p => p.id===req.params.postId);
  if (idx<0) return res.status(404).json({ error:'Post not found' });
  db.posts[idx] = { ...db.posts[idx], ...req.body };
  saveDB(); res.json(db.posts[idx]);
});

app.delete('/api/feeds/:feedId/posts/:postId', authMiddleware, (req, res) => {
  db.posts = db.posts.filter(p => p.id!==req.params.postId);
  saveDB(); res.json({ success:true });
});

// ─── PUBLIC WIDGET API ────────────────────────────────────────────────────────
app.get('/api/widget/:apiKey', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const feed = db.feeds.find(f => f.apiKey===req.params.apiKey);
  if (!feed) return res.status(404).json({ error:'Feed not found. Check your API key.' });
  if (!feed.published) return res.status(403).json({ error:'Feed is not published. Open admin → Publish & Embed → toggle Live.' });

  const posts = db.posts
    .filter(p => p.feedId===feed.id && p.published)
    .sort((a,b) => { if(a.pinned&&!b.pinned)return -1; if(!a.pinned&&b.pinned)return 1; return new Date(b.publishedAt)-new Date(a.publishedAt); })
    .slice(0, feed.maxPosts);

  res.json({
    feed: { id:feed.id, name:feed.name, theme:feed.theme, layout:feed.layout,
      columns:feed.columns, gap:feed.gap, cardRadius:feed.cardRadius,
      showAvatar:feed.showAvatar, showUsername:feed.showUsername,
      showCaption:feed.showCaption, showPlatform:feed.showPlatform, showDate:feed.showDate },
    posts,
  });
});

// ─── WIDGET SCRIPT (embeddable) ───────────────────────────────────────────────
app.get('/widget.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Access-Control-Allow-Origin', '*');
  const base = getBaseUrl(req);
  res.send(`(function(){
var SF='${base}';
function init(k,id,opts){
  opts=opts||{};var el=document.getElementById(id);
  if(!el)return console.error('SocialFeed: #'+id+' not found');
  el.innerHTML='<div style="text-align:center;padding:40px;font-family:sans-serif;color:#888">Loading...</div>';
  fetch(SF+'/api/widget/'+k)
    .then(function(r){return r.json().then(function(d){return{ok:r.ok,d:d}})})
    .then(function(x){x.ok?render(el,x.d.feed,x.d.posts,opts):el.innerHTML='<div style="color:#ef4444;padding:20px;text-align:center;font-family:sans-serif;font-size:13px">'+x.d.error+'</div>'})
    .catch(function(){el.innerHTML='<div style="color:#ef4444;padding:20px;text-align:center;font-family:sans-serif">Could not load feed</div>'});
}
var PC={instagram:'#E4405F',youtube:'#FF0000',twitter:'#1DA1F2',x:'#000',facebook:'#1877F2',tiktok:'#010101',linkedin:'#0A66C2',reddit:'#FF4500',vimeo:'#1AB7EA',flickr:'#FF0084'};
function ago(d){var s=Math.floor((new Date()-new Date(d))/1000);if(s<60)return s+'s';if(s<3600)return Math.floor(s/60)+'m';if(s<86400)return Math.floor(s/3600)+'h';return Math.floor(s/86400)+'d';}
function fmt(n){return n>=1000?(n/1000).toFixed(1)+'k':String(n);}
function render(el,f,posts,opts){
  var dark=(opts.theme||f.theme)==='dark';
  var bg=dark?'#0a0a0a':'#f5f5f5',cb=dark?'#1a1a1a':'#fff',tc=dark?'#e0e0e0':'#111',sc=dark?'#888':'#666',br=dark?'rgba(255,255,255,.08)':'rgba(0,0,0,.08)';
  var cols=opts.columns||f.columns||3,gap=f.gap||16,rad=f.cardRadius||12;
  var isC=f.layout==='carousel';
  var gs=isC?'display:flex;overflow-x:auto;gap:'+gap+'px;padding-bottom:8px':'display:grid;grid-template-columns:repeat('+cols+',1fr);gap:'+gap+'px';
  var s=document.createElement('style');
  s.textContent='.sfc{background:'+cb+';border-radius:'+rad+'px;border:1px solid '+br+';overflow:hidden;transition:transform .2s,box-shadow .2s;cursor:pointer'+(isC?';min-width:260px;flex-shrink:0':'')+';box-sizing:border-box}.sfc:hover{transform:translateY(-3px);box-shadow:0 12px 40px rgba(0,0,0,.3)}.sfm{width:100%;aspect-ratio:1;object-fit:cover;display:block}.sfph{width:100%;aspect-ratio:1;background:'+(dark?'#222':'#eee')+';display:flex;align-items:center;justify-content:center;font-size:2em}.sfb{padding:12px}.sfh{display:flex;align-items:center;gap:8px;margin-bottom:8px}.sfav{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:white;flex-shrink:0}.sfui{flex:1;min-width:0}.sfun{font-size:12px;font-weight:600;color:'+tc+';white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sfpl{font-size:10px;margin-top:1px}.sfcp{font-size:12px;color:'+tc+';line-height:1.5;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;margin-bottom:8px}.sfft{display:flex;justify-content:space-between;align-items:center;font-size:11px;color:'+sc+'}.sfst{display:flex;gap:8px}@media(max-width:600px){.sfgrid{grid-template-columns:repeat(2,1fr)!important}}';
  document.head.appendChild(s);
  var html=posts.map(function(p){
    var c=PC[p.platform]||'#666',ini=(p.displayName||p.username||'?')[0].toUpperCase();
    var hm=p.media&&p.media[0];
    return '<div class="sfc" onclick="window.open(\''+p.url+'\',\'_blank\')">'
      +(hm?'<img class="sfm" src="'+p.media[0]+'" loading="lazy" onerror="this.style.display=\'none\'" />'
         :'<div class="sfph">'+('youtube tiktok vimeo'.indexOf(p.platform)>=0?'▶️':'🖼️')+'</div>')
      +'<div class="sfb">'
      +(f.showAvatar||f.showUsername?'<div class="sfh"><div class="sfav" style="background:'+c+'">'+ini+'</div><div class="sfui">'+(f.showUsername?'<div class="sfun">'+(p.displayName||p.username)+'</div>':'')+(f.showPlatform?'<div class="sfpl" style="color:'+c+'">'+p.platform+'</div>':'')+'</div></div>':'')
      +(f.showCaption&&p.content?'<div class="sfcp">'+p.content.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')+'</div>':'')
      +'<div class="sfft">'+(f.showDate?'<span>'+ago(p.publishedAt)+'</span>':'<span></span>')
      +'<div class="sfst">'+(p.likes?'<span>❤ '+fmt(p.likes)+'</span>':'')+(p.comments?'<span>💬 '+fmt(p.comments)+'</span>':'')+'</div></div>'
      +'</div></div>';
  }).join('');
  el.innerHTML='<div style="background:'+bg+';padding:'+gap+'px;border-radius:'+rad+'px"><div class="sfgrid" style="'+gs+'">'+html+'</div></div>';
}
window.SocialFeed={init:init};
})();`);
});

// ─── HELPER PAGES ─────────────────────────────────────────────────────────────
function credsMissingPage(platform, name) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Setup Required</title>
<style>body{font-family:-apple-system,sans-serif;background:#0a0a0f;color:#e0e0e0;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px}
.card{background:#1a1a2e;border:1px solid rgba(234,179,8,.3);border-radius:16px;padding:36px;max-width:460px;width:100%}
h2{color:#eab308;margin:0 0 12px;font-size:20px}p{color:#aaa;font-size:14px;line-height:1.6;margin-bottom:16px}
.steps{background:rgba(255,255,255,.04);border-radius:10px;padding:16px;margin-bottom:20px}
.step{font-size:13px;color:#ccc;margin-bottom:8px;padding-left:20px;position:relative}
.step::before{content:attr(data-n);position:absolute;left:0;color:#7c6ef7;font-weight:700}
a{color:#a594f9}
.btn{width:100%;padding:12px;background:#333;color:#ccc;border:none;border-radius:10px;font-size:14px;cursor:pointer;margin-top:4px}</style></head>
<body><div class="card">
<h2>⚠️ App Credentials Needed for ${name}</h2>
<p>To connect real ${name} accounts, you first need to create a developer app on ${name}'s platform and enter your credentials in SocialFeed.</p>
<div class="steps">
  <div class="step" data-n="1.">Close this popup</div>
  <div class="step" data-n="2.">In the admin panel → Sources → click "⚙️ App Credentials"</div>
  <div class="step" data-n="3.">Enter your ${name} Client ID &amp; Secret</div>
  <div class="step" data-n="4.">Try connecting again</div>
</div>
<p>See README.md for detailed instructions on creating developer apps for each platform.</p>
<button class="btn" onclick="window.close()">Close</button>
</div></body></html>`;
}

function oauthDonePage(success, platform, errMsg, profile) {
  const name = platform.charAt(0).toUpperCase() + platform.slice(1);
  if (success) {
    const profileJson = JSON.stringify(profile||{}).replace(/</g,'\\u003c');
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Connected!</title>
<style>body{font-family:-apple-system,sans-serif;background:#0a0a0f;color:#e0e0e0;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
.card{background:#1a1a2e;border:1px solid rgba(34,197,94,.3);border-radius:16px;padding:40px;text-align:center;width:360px}
.icon{font-size:56px;margin-bottom:16px}.h{font-size:22px;font-weight:700;color:#22c55e;margin-bottom:8px}
.p{color:#888;font-size:14px;margin-bottom:16px}.nm{font-size:16px;font-weight:600;margin-bottom:4px}.hn{font-size:13px;color:#888}</style></head>
<body><div class="card">
<div class="icon">✅</div>
<div class="h">${name} Connected!</div>
<p class="p">Authorization successful. Your posts are being fetched now.</p>
<div class="nm">${profile?.name||''}</div>
<div class="hn">${profile?.handle||''}</div>
</div>
<script>
setTimeout(function(){
  if(window.opener){window.opener.postMessage({type:'OAUTH_SUCCESS',platform:'${platform}',profile:${profileJson}},'*');}
  window.close();
},1800);
</script></body></html>`;
  }
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Failed</title>
<style>body{font-family:-apple-system,sans-serif;background:#0a0a0f;color:#e0e0e0;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
.card{background:#1a1a2e;border:1px solid rgba(239,68,68,.3);border-radius:16px;padding:40px;text-align:center;width:380px}
.icon{font-size:56px;margin-bottom:16px}.h{color:#ef4444;font-size:20px;font-weight:700;margin-bottom:12px}
.err{background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.2);border-radius:8px;padding:12px;font-size:13px;color:#fca5a5;margin-bottom:20px;word-break:break-word}
.btn{width:100%;padding:12px;background:#333;color:#ccc;border:none;border-radius:10px;font-size:14px;cursor:pointer}</style></head>
<body><div class="card">
<div class="icon">❌</div>
<div class="h">Connection Failed</div>
<div class="err">${errMsg||'Unknown error occurred'}</div>
<button class="btn" onclick="window.close()">Close</button>
</div></body></html>`;
}

app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../frontend/index.html')));

app.listen(PORT, () => {
  console.log(`\n🚀  SocialFeed running → http://localhost:${PORT}`);
  console.log(`📧  Login: admin@socialfeed.com / admin123`);
  console.log(`\n📋  Next step: create .env with your platform API keys`);
  console.log(`    See README.md for per-platform setup instructions\n`);
});
