# SocialFeed — Vercel Deployment Guide

## Step 1: Set Up MongoDB (Free)

1. Go to https://www.mongodb.com/atlas
2. Create a free account → Create a free M0 cluster
3. Database Access → Add new user (username + password, note them down)
4. Network Access → Add IP Address → Allow Access From Anywhere (0.0.0.0/0)
5. Clusters → Connect → Connect your application → Copy the connection string
   It looks like: `mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/socialfeed?retryWrites=true&w=majority`

## Step 2: Deploy to Vercel

### Option A — Vercel Dashboard (easiest)
1. Go to https://vercel.com → New Project
2. Import from GitHub (push this folder to GitHub first), OR
3. Use Vercel CLI: `npm i -g vercel` then run `vercel` in this folder

### Option B — Vercel CLI
```bash
npm install -g vercel
vercel login
vercel --prod
```

## Step 3: Add Environment Variables in Vercel

Go to your Vercel project → Settings → Environment Variables and add:

| Variable | Value | Required |
|----------|-------|----------|
| `MONGODB_URI` | Your MongoDB Atlas connection string | ✅ YES |
| `JWT_SECRET` | Any random string (e.g. `my_super_secret_key_123`) | ✅ YES |
| `BASE_URL` | Your Vercel URL e.g. `https://yourapp.vercel.app` | ✅ YES |
| `INSTAGRAM_CLIENT_ID` | Instagram App ID | For Instagram |
| `INSTAGRAM_CLIENT_SECRET` | Instagram App Secret | For Instagram |
| `FACEBOOK_APP_ID` | Facebook App ID | For Facebook |
| `FACEBOOK_APP_SECRET` | Facebook App Secret | For Facebook |
| `YOUTUBE_CLIENT_ID` | Google OAuth Client ID | For YouTube |
| `YOUTUBE_CLIENT_SECRET` | Google OAuth Client Secret | For YouTube |
| `TWITTER_CLIENT_ID` | Twitter OAuth 2.0 Client ID | For Twitter |
| `TWITTER_CLIENT_SECRET` | Twitter OAuth 2.0 Client Secret | For Twitter |
| `LINKEDIN_CLIENT_ID` | LinkedIn Client ID | For LinkedIn |
| `LINKEDIN_CLIENT_SECRET` | LinkedIn Client Secret | For LinkedIn |
| `REDDIT_CLIENT_ID` | Reddit App ID | For Reddit |
| `REDDIT_CLIENT_SECRET` | Reddit App Secret | For Reddit |
| `TIKTOK_CLIENT_KEY` | TikTok Client Key | For TikTok |
| `TIKTOK_CLIENT_SECRET` | TikTok Client Secret | For TikTok |

## Step 4: Update OAuth Redirect URIs

For every platform you want to connect, update the Redirect URI from:
`http://localhost:3000/oauth/callback/PLATFORM`
to:
`https://yourapp.vercel.app/oauth/callback/PLATFORM`

## Step 5: Done!

Open `https://yourapp.vercel.app`
Login: admin@socialfeed.com / admin123

## File Structure
```
vercel-socialfeed/
├── api/
│   ├── _db.js            # MongoDB models (shared)
│   ├── _helpers.js        # Auth, CORS utils (shared)
│   ├── _fetchers.js       # Real social media API fetchers (shared)
│   ├── auth.js            # POST /api/auth (login/register/me)
│   ├── feeds.js           # CRUD /api/feeds
│   ├── sources.js         # CRUD /api/sources
│   ├── posts.js           # CRUD /api/posts
│   ├── credentials.js     # /api/credentials (store platform keys)
│   ├── widget.js          # GET /api/widget?apiKey= (public)
│   ├── widget-script.js   # GET /widget.js (embeddable script)
│   ├── oauth-start.js     # GET /oauth/start/:platform
│   └── oauth-callback.js  # GET /oauth/callback/:platform
├── public/
│   ├── index.html         # Admin panel
│   └── demo.html          # Widget preview
├── vercel.json            # Vercel routing config
└── package.json
```

## Embedding on Any Website

After deploying and publishing a feed:
```html
<div id="my-feed"></div>
<script src="https://yourapp.vercel.app/widget.js"></script>
<script>
  SocialFeed.init('YOUR_API_KEY', 'my-feed');
</script>
```
