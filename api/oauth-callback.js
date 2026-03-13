const { connectDB, Credential, OAuthState, Source, Post } = require('./_db');
const { getCreds, getBaseUrl } = require('./_helpers');
const { getProfile, exchangeToken, fetchPosts } = require('./_fetchers');
const { v4: uuidv4 } = require('uuid');

module.exports = async (req, res) => {
  await connectDB();

  const platform = req.query.platform;
  const { code, state, error, error_description } = req.query;

  if (error) return res.send(donePage(false, platform, error_description || error));
  if (!code || !state) return res.send(donePage(false, platform, 'Missing code or state'));

  const stateDoc = await OAuthState.findOne({ state });
  if (!stateDoc) return res.send(donePage(false, platform, 'Invalid or expired state. Please try connecting again.'));

  let stateData;
  try { stateData = JSON.parse(stateDoc.data); } catch { return res.send(donePage(false, platform, 'Corrupt state')); }

  const { userId, feedId, type } = stateData;
  const pkce = stateDoc.pkce || '';
  await OAuthState.deleteOne({ state });

  const storedCred = await Credential.findOne({ userId, platform }).lean();
  const cfg = getCreds(platform, storedCred);
  const baseUrl = getBaseUrl(req);
  const redirectUri = `${baseUrl}/oauth/callback/${platform}`;

  try {
    const tokenData = await exchangeToken(platform, code, cfg, redirectUri, pkce);
    if (!tokenData || tokenData.error)
      throw new Error(tokenData?.error_description || tokenData?.error || 'Token exchange failed');

    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token || '';
    const profile = await getProfile(platform, accessToken);

    const source = await Source.create({
      feedId,
      userId,
      platform,
      type: type || 'profile',
      handle: profile.handle || '',
      displayName: profile.name || '',
      avatar: profile.avatar || '',
      accessToken,
      refreshToken,
      platformUserId: profile.id || '',
      status: 'connected',
      lastSync: new Date(),
    });

    const sourceId = source._id.toString();

    // Fetch real posts immediately
    try {
      const posts = await fetchPosts({ ...source.toObject(), _id: sourceId });
      let added = 0;
      for (const p of posts) {
        const exists = await Post.findOne({ feedId, externalId: p.externalId });
        if (!exists) {
          await Post.create({
            ...p,
            feedId,
            sourceId,
            platform,
            published: true,
            pinned: false,
          });
          added++;
        }
      }
      console.log(`[${platform}] Added ${added} posts for feed ${feedId}`);
    } catch (syncErr) {
      console.error(`[${platform}] Sync error:`, syncErr.message);
    }

    return res.send(donePage(true, platform, null, profile));
  } catch (e) {
    console.error(`[${platform}] OAuth error:`, e.message);
    return res.send(donePage(false, platform, e.message));
  }
};

function donePage(success, platform, errMsg, profile) {
  const name = (platform || 'Platform').charAt(0).toUpperCase() + (platform || '').slice(1);
  const profileJson = JSON.stringify(profile || {}).replace(/</g, '\\u003c').replace(/"/g, '\\"');

  if (success) {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Connected!</title>
<style>body{font-family:-apple-system,sans-serif;background:#0a0a0f;color:#e0e0e0;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
.c{background:#1a1a2e;border:1px solid rgba(34,197,94,.3);border-radius:16px;padding:40px;text-align:center;width:340px}
.ic{font-size:52px;margin-bottom:14px}.h{font-size:20px;font-weight:700;color:#22c55e;margin-bottom:8px}
.p{color:#888;font-size:13px;margin-bottom:14px}.nm{font-size:15px;font-weight:600}.hn{font-size:12px;color:#888;margin-top:2px}</style></head>
<body><div class="c">
<div class="ic">✅</div>
<div class="h">${name} Connected!</div>
<div class="p">Posts are being imported now.</div>
<div class="nm">${profile?.name || ''}</div>
<div class="hn">${profile?.handle || ''}</div>
</div>
<script>
var profile = JSON.parse("${profileJson}");
setTimeout(function(){
  if(window.opener){ window.opener.postMessage({type:'OAUTH_SUCCESS',platform:'${platform}',profile:profile},'*'); }
  window.close();
}, 1800);
</script></body></html>`;
  }

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Failed</title>
<style>body{font-family:-apple-system,sans-serif;background:#0a0a0f;color:#e0e0e0;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
.c{background:#1a1a2e;border:1px solid rgba(239,68,68,.3);border-radius:16px;padding:40px;text-align:center;width:380px}
.ic{font-size:52px;margin-bottom:14px}.h{color:#ef4444;font-size:20px;font-weight:700;margin-bottom:10px}
.e{background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.2);border-radius:8px;padding:12px;font-size:13px;color:#fca5a5;margin-bottom:16px;word-break:break-word;text-align:left}
.btn{width:100%;padding:11px;background:#333;color:#ccc;border:none;border-radius:8px;font-size:14px;cursor:pointer}</style></head>
<body><div class="c">
<div class="ic">❌</div>
<div class="h">Connection Failed</div>
<div class="e">${errMsg || 'Unknown error'}</div>
<button class="btn" onclick="window.close()">Close</button>
</div></body></html>`;
}
