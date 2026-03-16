const { connectDB, Credential, OAuthState } = require('./_db');
const { getCreds, getBaseUrl, verifyToken, getToken } = require('./_helpers');
const { v4: uuidv4 } = require('uuid');

module.exports = async (req, res) => {
  await connectDB();

  const platform = req.query.platform;
  const { feedId, type } = req.query;

  // Get userId from JWT token (reliable) not query param
  let userId;
  try {
    const payload = verifyToken(getToken(req));
    userId = payload.id;
  } catch(e) {
    return res.status(401).send('Unauthorized - please log in again');
  }

  if (!platform || !userId) return res.status(400).send('Missing params');

  const storedCred = await Credential.findOne({ userId, platform }).lean();
  const cfg = getCreds(platform, storedCred);
  const baseUrl = getBaseUrl(req);
  const redirectUri = `${baseUrl}/oauth/callback/${platform}`;

  if (!cfg.clientId) {
    return res.status(200).send(credsMissingHtml(cfg.name || platform));
  }

  // Generate state + PKCE
  const stateKey = uuidv4();
  const stateData = JSON.stringify({ userId, feedId, type: type || 'profile' });
  const pkce = Buffer.from(uuidv4()).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 43);

  await OAuthState.create({ state: stateKey, data: stateData, pkce });

  let authUrl = '';
  switch (platform) {
    case 'instagram':
      authUrl = `${cfg.authUrl}?client_id=${cfg.clientId}&redirect_uri=${enc(redirectUri)}&scope=${cfg.scope}&response_type=code&state=${stateKey}`;
      break;
    case 'facebook':
      authUrl = `${cfg.authUrl}?client_id=${cfg.clientId}&redirect_uri=${enc(redirectUri)}&scope=${cfg.scope}&response_type=code&state=${stateKey}`;
      break;
    case 'youtube':
      authUrl = `${cfg.authUrl}?client_id=${cfg.clientId}&redirect_uri=${enc(redirectUri)}&scope=${enc(cfg.scope)}&response_type=code&access_type=offline&prompt=consent&state=${stateKey}`;
      break;
    case 'twitter':
      authUrl = `${cfg.authUrl}?response_type=code&client_id=${cfg.clientId}&redirect_uri=${enc(redirectUri)}&scope=${enc(cfg.scope)}&state=${stateKey}&code_challenge=${pkce}&code_challenge_method=plain`;
      break;
    case 'linkedin':
      authUrl = `${cfg.authUrl}?response_type=code&client_id=${cfg.clientId}&redirect_uri=${enc(redirectUri)}&scope=${enc(cfg.scope)}&state=${stateKey}`;
      break;
    case 'reddit':
      authUrl = `${cfg.authUrl}?client_id=${cfg.clientId}&response_type=code&state=${stateKey}&redirect_uri=${enc(redirectUri)}&duration=permanent&scope=${enc(cfg.scope)}`;
      break;
    case 'tiktok':
      authUrl = `${cfg.authUrl}?client_key=${cfg.clientId}&response_type=code&scope=${enc(cfg.scope)}&redirect_uri=${enc(redirectUri)}&state=${stateKey}`;
      break;
    default:
      return res.status(400).send('Unknown platform');
  }

  res.redirect(authUrl);
};

function enc(s) { return encodeURIComponent(s); }

function credsMissingHtml(name) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Setup Needed</title>
<style>body{font-family:-apple-system,sans-serif;background:#0a0a0f;color:#e0e0e0;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px}
.c{background:#1a1a2e;border:1px solid rgba(234,179,8,.3);border-radius:16px;padding:36px;max-width:440px;width:100%;text-align:center}
h2{color:#eab308;margin:0 0 12px}p{color:#aaa;font-size:14px;line-height:1.6;margin-bottom:16px}
.btn{padding:11px 24px;background:#333;color:#ccc;border:none;border-radius:8px;font-size:14px;cursor:pointer}</style></head>
<body><div class="c">
<h2>⚠️ ${name} Credentials Missing</h2>
<p>You haven't added your ${name} app credentials yet.</p>
<p>Go back → <b>App Credentials</b> tab → enter your Client ID &amp; Secret for ${name} → Save → try connecting again.</p>
<button class="btn" onclick="window.close()">Close</button>
</div></body></html>`;
}
