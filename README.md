# 📡 SocialFeed Aggregator — Curator.io Clone

A self-hosted, full-featured social media feed aggregator. Collect posts from Instagram, YouTube, X/Twitter, Facebook, TikTok, LinkedIn, Reddit, and more — then embed the beautiful widget on any website.

---

## 🚀 Quick Start

### 1. Install & Run

```bash
cd socialfeed
npm install --ignore-scripts express bcryptjs jsonwebtoken uuid cors
node backend/server.js
```

Open: **http://localhost:3000**

### 2. Default Login
- **Email:** `admin@socialfeed.com`
- **Password:** `admin123`

---

## ✨ Features

### Admin Panel
- 🔐 **Auth** — Login / Register with JWT tokens
- 📡 **Feeds** — Create multiple feed aggregators
- 🔗 **Sources** — Add platforms (Instagram, YouTube, X, Facebook, TikTok, LinkedIn, Reddit, Vimeo, Flickr)
- 📝 **Posts** — Auto-pulled sample posts per source, manual post adding, publish/unpublish, pin to top, delete
- 🎨 **Design** — Live preview, dark/light theme, grid/masonry/carousel layout, column count, gap, border radius, show/hide elements
- 🚀 **Publish** — Toggle feed live, copy API key, get embed code

### Widget Embed
Add these 3 lines to ANY website:

```html
<div id="my-social-feed"></div>
<script src="http://localhost:3000/widget.js"></script>
<script>SocialFeed.init('YOUR_API_KEY', 'my-social-feed');</script>
```

---

## 📁 Project Structure

```
socialfeed/
├── backend/
│   └── server.js          # Express API + widget.js endpoint
├── frontend/
│   ├── index.html         # Full admin panel (single file)
│   └── demo.html          # Widget preview page
├── database.json          # Auto-created JSON database
└── README.md
```

---

## 🔌 Connecting Real Social Media APIs

### Instagram
1. Create a Facebook App at developers.facebook.com
2. Add Instagram Basic Display product
3. Get User Token → paste in Source Access Token field

### YouTube
1. Go to console.cloud.google.com
2. Enable YouTube Data API v3
3. Create API Key → paste in Access Token field

### X / Twitter
1. Apply at developer.twitter.com
2. Create an App → get Bearer Token
3. Paste Bearer Token in Access Token field

### Facebook
1. Create a Page Access Token at developers.facebook.com
2. Use Graph API Explorer
3. Paste token in Access Token field

> **Note:** Without real tokens, the app generates realistic sample posts for preview/testing.

---

## 🌐 Deploying to Production

### Option A: Railway / Render (free)
```bash
# Push to GitHub → connect to Railway/Render
# Set PORT env variable
# Done!
```

### Option B: VPS / Ubuntu Server
```bash
npm install -g pm2
pm2 start backend/server.js --name socialfeed
pm2 save
```

Update the widget embed URL from `localhost:3000` to your domain.

---

## 🔒 Security Notes

- Change `JWT_SECRET` in server.js before deploying
- Use HTTPS in production
- Add rate limiting for the public `/api/widget/:key` endpoint
- Consider Redis instead of JSON file for production database

---

## 📋 API Reference

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/auth/login` | POST | No | Login |
| `/api/auth/register` | POST | No | Register |
| `/api/feeds` | GET | Yes | List feeds |
| `/api/feeds` | POST | Yes | Create feed |
| `/api/feeds/:id` | PUT | Yes | Update feed |
| `/api/feeds/:id` | DELETE | Yes | Delete feed |
| `/api/feeds/:id/sources` | GET/POST | Yes | Manage sources |
| `/api/feeds/:id/posts` | GET/POST/PUT/DELETE | Yes | Manage posts |
| `/api/widget/:apiKey` | GET | No (public) | Widget data |
| `/widget.js` | GET | No (public) | Embeddable script |
