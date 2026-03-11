const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// API routes
app.use('/api/auth',        require('./api/auth'));
app.use('/api/feeds',       require('./api/feeds'));
app.use('/api/sources',     require('./api/sources'));
app.use('/api/posts',       require('./api/posts'));
app.use('/api/credentials', require('./api/credentials'));
app.use('/api/widget',      require('./api/widget'));
app.get('/widget.js',       require('./api/widget-script'));
app.get('/oauth/start/:platform',    (req, res) => { req.query.platform = req.params.platform; require('./api/oauth-start')(req, res); });
app.get('/oauth/callback/:platform', (req, res) => { req.query.platform = req.params.platform; require('./api/oauth-callback')(req, res); });

// Fallback to index.html
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

module.exports = app;
