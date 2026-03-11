// Load .env file if it exists (for local development)
const fs = require('fs');
const path = require('path');
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const eq = line.indexOf('=');
    if (eq > 0 && !line.startsWith('#')) {
      const k = line.substring(0, eq).trim();
      const v = line.substring(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (k && !process.env[k]) process.env[k] = v;
    }
  });
}

const express = require('express');
const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

function wrap(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res)).catch(err => {
      console.error('Handler error:', err.message);
      if (!res.headersSent) res.status(500).json({ error: err.message || 'Internal server error' });
    });
  };
}

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// OAuth routes
app.get('/oauth/start/:platform', (req, res, next) => { req.query.platform = req.params.platform; next(); }, wrap(require('./api/oauth-start')));
app.get('/oauth/callback/:platform', (req, res, next) => { req.query.platform = req.params.platform; next(); }, wrap(require('./api/oauth-callback')));

// Widget script
app.get('/widget.js', wrap(require('./api/widget-script')));

// API routes
app.all('/api/health',      wrap(require('./api/health')));
app.all('/api/auth',        wrap(require('./api/auth')));
app.all('/api/feeds',       wrap(require('./api/feeds')));
app.all('/api/sources',     wrap(require('./api/sources')));
app.all('/api/posts',       wrap(require('./api/posts')));
app.all('/api/credentials', wrap(require('./api/credentials')));
app.all('/api/widget',      wrap(require('./api/widget')));

// SPA fallback
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`\n🚀  SocialFeed running → http://localhost:${PORT}`);
    console.log(`📧  Login: admin@socialfeed.com / admin123\n`);
  });
}
