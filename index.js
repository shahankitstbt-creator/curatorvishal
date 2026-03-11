const express = require('express');
const path = require('path');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Wrap a serverless-style handler (req,res) => Promise into Express middleware
function wrap(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res)).catch(err => {
      console.error('Handler error:', err);
      if (!res.headersSent) res.status(500).json({ error: err.message || 'Internal server error' });
    });
  };
}

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// OAuth routes (extract :platform from path into query)
app.get('/oauth/start/:platform', (req, res, next) => {
  req.query.platform = req.params.platform;
  next();
}, wrap(require('./api/oauth-start')));

app.get('/oauth/callback/:platform', (req, res, next) => {
  req.query.platform = req.params.platform;
  next();
}, wrap(require('./api/oauth-callback')));

// Widget script
app.get('/widget.js', wrap(require('./api/widget-script')));

// API routes — all methods
app.all('/api/auth',        wrap(require('./api/auth')));
app.all('/api/feeds',       wrap(require('./api/feeds')));
app.all('/api/sources',     wrap(require('./api/sources')));
app.all('/api/posts',       wrap(require('./api/posts')));
app.all('/api/credentials', wrap(require('./api/credentials')));
app.all('/api/widget',      wrap(require('./api/widget')));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

module.exports = app;
