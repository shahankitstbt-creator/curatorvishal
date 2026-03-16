const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'socialfeed_change_this';

function getToken(req) {
  return (req.headers.authorization || '').replace('Bearer ', '').trim();
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

function hashPassword(pw) {
  return bcrypt.hashSync(pw, 10);
}

function checkPassword(pw, hash) {
  return bcrypt.compareSync(pw, hash);
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function json(res, data, status = 200) {
  cors(res);
  res.status(status).json(data);
}

function err(res, message, status = 400) {
  cors(res);
  res.status(status).json({ error: message });
}

function getBaseUrl(req) {
  if (process.env.BASE_URL) return process.env.BASE_URL;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

const PLATFORM_OAUTH = {
  instagram: {
    name: 'Instagram', color: '#E4405F',
    authUrl: 'https://api.instagram.com/oauth/authorize',
    tokenUrl: 'https://api.instagram.com/oauth/access_token',
    scope: 'user_profile,user_media',
    envId: 'INSTAGRAM_CLIENT_ID', envSecret: 'INSTAGRAM_CLIENT_SECRET',
  },
  facebook: {
    name: 'Facebook', color: '#1877F2',
    authUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v19.0/oauth/access_token',
    scope: 'public_profile,pages_show_list,pages_read_engagement,pages_manage_posts',
    envId: 'FACEBOOK_APP_ID', envSecret: 'FACEBOOK_APP_SECRET',
  },
  youtube: {
    name: 'YouTube', color: '#FF0000',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'https://www.googleapis.com/auth/youtube.readonly',
    envId: 'YOUTUBE_CLIENT_ID', envSecret: 'YOUTUBE_CLIENT_SECRET',
  },
  twitter: {
    name: 'X / Twitter', color: '#000000',
    authUrl: 'https://twitter.com/i/oauth2/authorize',
    tokenUrl: 'https://api.twitter.com/2/oauth2/token',
    scope: 'tweet.read users.read offline.access',
    envId: 'TWITTER_CLIENT_ID', envSecret: 'TWITTER_CLIENT_SECRET',
  },
  linkedin: {
    name: 'LinkedIn', color: '#0A66C2',
    authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    scope: 'r_liteprofile r_emailaddress',
    envId: 'LINKEDIN_CLIENT_ID', envSecret: 'LINKEDIN_CLIENT_SECRET',
  },
  reddit: {
    name: 'Reddit', color: '#FF4500',
    authUrl: 'https://www.reddit.com/api/v1/authorize',
    tokenUrl: 'https://www.reddit.com/api/v1/access_token',
    scope: 'identity read',
    envId: 'REDDIT_CLIENT_ID', envSecret: 'REDDIT_CLIENT_SECRET',
  },
  tiktok: {
    name: 'TikTok', color: '#010101',
    authUrl: 'https://www.tiktok.com/v2/auth/authorize/',
    tokenUrl: 'https://open.tiktokapis.com/v2/oauth/token/',
    scope: 'user.info.basic,video.list',
    envId: 'TIKTOK_CLIENT_KEY', envSecret: 'TIKTOK_CLIENT_SECRET',
  },
};

function getCreds(platform, storedCred) {
  const cfg = { ...PLATFORM_OAUTH[platform] };
  cfg.clientId = process.env[cfg.envId] || '';
  cfg.clientSecret = process.env[cfg.envSecret] || '';
  if (storedCred) {
    if (storedCred.clientId) cfg.clientId = storedCred.clientId;
    if (storedCred.clientSecret) cfg.clientSecret = storedCred.clientSecret;
    if (storedCred.bearerToken) cfg.bearerToken = storedCred.bearerToken;
  }
  return cfg;
}

module.exports = { getToken, verifyToken, signToken, hashPassword, checkPassword, cors, json, err, getBaseUrl, PLATFORM_OAUTH, getCreds };
