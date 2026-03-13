const fetch = require('node-fetch');

async function fetchPosts(source) {
  switch (source.platform) {
    case 'instagram': return fetchInstagram(source);
    case 'facebook':  return fetchFacebook(source);
    case 'youtube':   return fetchYouTube(source);
    case 'twitter':   return fetchTwitter(source);
    case 'linkedin':  return fetchLinkedIn(source);
    case 'reddit':    return fetchReddit(source);
    case 'tiktok':    return fetchTikTok(source);
    default: return [];
  }
}

async function getProfile(platform, token) {
  switch (platform) {
    case 'instagram': {
      const d = await apiFetch(`https://graph.instagram.com/me?fields=id,username&access_token=${token}`);
      if (d.error) throw new Error('Instagram: ' + d.error.message);
      return { id: d.id, handle: '@' + d.username, name: d.username };
    }
    case 'facebook': {
      const d = await apiFetch(`https://graph.facebook.com/me?fields=id,name,picture.width(200)&access_token=${token}`);
      if (d.error) throw new Error('Facebook: ' + d.error.message);
      return { id: d.id, handle: d.name, name: d.name, avatar: d.picture?.data?.url || '' };
    }
    case 'youtube': {
      const d = await apiFetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', { Authorization: `Bearer ${token}` });
      if (d.error) throw new Error('YouTube: ' + d.error.message);
      const ch = d.items?.[0];
      if (!ch) throw new Error('YouTube: No channel found');
      return { id: ch.id, handle: ch.snippet.title, name: ch.snippet.title, avatar: ch.snippet.thumbnails?.default?.url || '' };
    }
    case 'twitter': {
      const d = await apiFetch('https://api.twitter.com/2/users/me?user.fields=profile_image_url,name,username', { Authorization: `Bearer ${token}` });
      if (d.errors) throw new Error('Twitter: ' + d.errors[0].message);
      return { id: d.data?.id, handle: '@' + d.data?.username, name: d.data?.name, avatar: d.data?.profile_image_url || '' };
    }
    case 'linkedin': {
      const d = await apiFetch('https://api.linkedin.com/v2/me', { Authorization: `Bearer ${token}` });
      if (d.message) throw new Error('LinkedIn: ' + d.message);
      return { id: d.id, handle: `${d.localizedFirstName} ${d.localizedLastName}`, name: `${d.localizedFirstName} ${d.localizedLastName}` };
    }
    case 'reddit': {
      const d = await apiFetch('https://oauth.reddit.com/api/v1/me', { Authorization: `Bearer ${token}`, 'User-Agent': 'SocialFeed/2.0' });
      if (d.error) throw new Error('Reddit: ' + (d.message || d.error));
      return { id: d.id, handle: 'u/' + d.name, name: d.name, avatar: d.icon_img?.split('?')[0] || '' };
    }
    case 'tiktok': {
      const d = await apiFetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url', { Authorization: `Bearer ${token}` });
      if (d.error?.code !== 'ok') throw new Error('TikTok: ' + (d.error?.message || 'Profile failed'));
      const u = d.data?.user;
      return { id: u?.open_id, handle: u?.display_name, name: u?.display_name, avatar: u?.avatar_url || '' };
    }
    default: return { handle: platform, name: platform };
  }
}

async function exchangeToken(platform, code, cfg, redirectUri, pkce) {
  const f = (...args) => new URLSearchParams(Object.fromEntries(args[0]));
  switch (platform) {
    case 'instagram': {
      const form = new URLSearchParams({ client_id: cfg.clientId, client_secret: cfg.clientSecret, grant_type: 'authorization_code', redirect_uri: redirectUri, code });
      return postForm(cfg.tokenUrl, form);
    }
    case 'facebook': {
      return apiFetch(`${cfg.tokenUrl}?client_id=${cfg.clientId}&client_secret=${cfg.clientSecret}&code=${code}&redirect_uri=${encodeURIComponent(redirectUri)}`);
    }
    case 'youtube': {
      const form = new URLSearchParams({ code, client_id: cfg.clientId, client_secret: cfg.clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' });
      return postForm(cfg.tokenUrl, form);
    }
    case 'twitter': {
      const creds = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64');
      const form = new URLSearchParams({ code, grant_type: 'authorization_code', redirect_uri: redirectUri, code_verifier: pkce });
      return postForm(cfg.tokenUrl, form, { Authorization: `Basic ${creds}` });
    }
    case 'linkedin': {
      const form = new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri, client_id: cfg.clientId, client_secret: cfg.clientSecret });
      return postForm(cfg.tokenUrl, form);
    }
    case 'reddit': {
      const creds = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64');
      const form = new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri });
      return postForm(cfg.tokenUrl, form, { Authorization: `Basic ${creds}`, 'User-Agent': 'SocialFeed/2.0' });
    }
    case 'tiktok': {
      const form = new URLSearchParams({ client_key: cfg.clientId, client_secret: cfg.clientSecret, code, grant_type: 'authorization_code', redirect_uri: redirectUri });
      const d = await postForm(cfg.tokenUrl, form);
      return d.data || d;
    }
  }
}

// ─── PLATFORM FETCHERS ─────────────────────────────────────────────────────────

async function fetchInstagram(s) {
  const d = await apiFetch(`https://graph.instagram.com/me/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count&access_token=${s.accessToken}&limit=30`);
  if (d.error) throw new Error('Instagram: ' + d.error.message);
  return (d.data || []).map(p => ({
    externalId: 'ig_' + p.id,
    username: s.handle, displayName: s.displayName, avatar: s.avatar,
    content: p.caption || '',
    media: p.media_type === 'VIDEO' ? [p.thumbnail_url || ''] : [p.media_url || ''],
    url: p.permalink,
    likes: p.like_count || 0, comments: p.comments_count || 0, shares: 0,
    publishedAt: new Date(p.timestamp),
  }));
}

async function fetchFacebook(s) {
  const token = s.accessToken;

  // First try to get pages managed by this user
  const pagesData = await apiFetch(`https://graph.facebook.com/me/accounts?access_token=${token}`);

  let postsData;
  let displayName = s.displayName;
  let avatar = s.avatar;
  let handle = s.handle;

  if (!pagesData.error && pagesData.data && pagesData.data.length > 0) {
    // Use first page's access token to get page posts
    const page = pagesData.data[0];
    const pageToken = page.access_token;
    const pageId = page.id;
    displayName = page.name;
    handle = page.name;

    // Get page picture
    const picData = await apiFetch(`https://graph.facebook.com/${pageId}/picture?type=large&redirect=false&access_token=${pageToken}`);
    if (picData.data && picData.data.url) avatar = picData.data.url;

    postsData = await apiFetch(`https://graph.facebook.com/${pageId}/posts?fields=id,message,full_picture,permalink_url,created_time,reactions.summary(true),comments.summary(true)&access_token=${pageToken}&limit=30`);
  } else {
    // Fallback: try personal profile posts
    postsData = await apiFetch(`https://graph.facebook.com/me/posts?fields=id,message,full_picture,permalink_url,created_time,reactions.summary(true),comments.summary(true)&access_token=${token}&limit=30`);
  }

  if (postsData.error) throw new Error('Facebook: ' + postsData.error.message);

  return (postsData.data || []).map(p => ({
    externalId: 'fb_' + p.id,
    username: handle, displayName, avatar,
    content: p.message || '',
    media: p.full_picture ? [p.full_picture] : [],
    url: p.permalink_url || 'https://facebook.com',
    likes: p.reactions?.summary?.total_count || 0,
    comments: p.comments?.summary?.total_count || 0,
    shares: 0,
    publishedAt: new Date(p.created_time),
  }));
}

async function fetchYouTube(s) {
  // Step 1: get channel info including uploads playlist
  const chData = await apiFetch(
    'https://www.googleapis.com/youtube/v3/channels?part=contentDetails,snippet&mine=true',
    { Authorization: `Bearer ${s.accessToken}` }
  );
  if (chData.error) throw new Error('YouTube API error: ' + chData.error.message);
  if (!chData.items || chData.items.length === 0) throw new Error('YouTube: No channel found for this account');

  const channel = chData.items[0];
  const uploadsId = channel.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsId) throw new Error('YouTube: Could not find uploads playlist');

  // Step 2: get videos from uploads playlist
  const plData = await apiFetch(
    `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploadsId}&maxResults=50`,
    { Authorization: `Bearer ${s.accessToken}` }
  );
  if (plData.error) throw new Error('YouTube playlist error: ' + plData.error.message);
  if (!plData.items || plData.items.length === 0) return []; // channel has no videos

  const ids = plData.items.map(i => i.contentDetails.videoId).filter(Boolean).join(',');

  // Step 3: get video statistics
  const statsData = await apiFetch(
    `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${ids}`,
    { Authorization: `Bearer ${s.accessToken}` }
  );
  const statsMap = {};
  (statsData.items || []).forEach(v => { statsMap[v.id] = v.statistics; });

  return plData.items.map(item => {
    const sn = item.snippet;
    const vid = item.contentDetails.videoId;
    const st = statsMap[vid] || {};
    return {
      externalId: 'yt_' + vid,
      username: s.handle, displayName: s.displayName, avatar: s.avatar,
      content: sn.title + (sn.description ? '\n\n' + sn.description.substring(0, 200) : ''),
      media: [sn.thumbnails?.high?.url || sn.thumbnails?.maxres?.url || sn.thumbnails?.default?.url || ''],
      url: `https://www.youtube.com/watch?v=${vid}`,
      likes: parseInt(st.likeCount) || 0, comments: parseInt(st.commentCount) || 0, shares: 0,
      publishedAt: new Date(sn.publishedAt || sn.publishTime || Date.now()),
    };
  });
}

async function fetchTwitter(s) {
  const me = await apiFetch('https://api.twitter.com/2/users/me', { Authorization: `Bearer ${s.accessToken}` });
  if (me.errors) throw new Error('Twitter: ' + me.errors[0].message);

  const d = await apiFetch(
    `https://api.twitter.com/2/users/${me.data.id}/tweets?tweet.fields=created_at,public_metrics,attachments&expansions=attachments.media_keys&media.fields=url,preview_image_url&max_results=20`,
    { Authorization: `Bearer ${s.accessToken}` }
  );
  if (d.errors) throw new Error('Twitter: ' + d.errors[0].message);

  const mediaMap = {};
  (d.includes?.media || []).forEach(m => { mediaMap[m.media_key] = m.url || m.preview_image_url || ''; });

  return (d.data || []).map(t => ({
    externalId: 'tw_' + t.id,
    username: s.handle, displayName: s.displayName, avatar: s.avatar,
    content: t.text,
    media: (t.attachments?.media_keys || []).map(k => mediaMap[k]).filter(Boolean),
    url: `https://twitter.com/i/web/status/${t.id}`,
    likes: t.public_metrics?.like_count || 0,
    comments: t.public_metrics?.reply_count || 0,
    shares: t.public_metrics?.retweet_count || 0,
    publishedAt: new Date(t.created_at),
  }));
}

async function fetchLinkedIn(s) {
  const d = await apiFetch(
    `https://api.linkedin.com/v2/ugcPosts?q=authors&authors=List(${encodeURIComponent('urn:li:person:' + s.platformUserId)})&count=20`,
    { Authorization: `Bearer ${s.accessToken}`, 'X-Restli-Protocol-Version': '2.0.0' }
  );
  if (d.message) throw new Error('LinkedIn: ' + d.message);
  return (d.elements || []).map(p => ({
    externalId: 'li_' + p.id,
    username: s.handle, displayName: s.displayName, avatar: s.avatar,
    content: p.specificContent?.['com.linkedin.ugc.ShareContent']?.shareCommentary?.text || '',
    media: [], url: `https://www.linkedin.com/feed/update/${p.id}`,
    likes: 0, comments: 0, shares: 0,
    publishedAt: new Date(p.created?.time || Date.now()),
  }));
}

async function fetchReddit(s) {
  const username = (s.handle || '').replace('u/', '');
  const d = await apiFetch(
    `https://oauth.reddit.com/user/${username}/submitted?limit=25`,
    { Authorization: `Bearer ${s.accessToken}`, 'User-Agent': 'SocialFeed/2.0' }
  );
  if (d.error) throw new Error('Reddit: ' + (d.message || d.error));
  return (d.data?.children || []).map(({ data: p }) => ({
    externalId: 'rd_' + p.id,
    username: 'u/' + p.author, displayName: p.author, avatar: s.avatar,
    content: p.title + (p.selftext ? '\n\n' + p.selftext.substring(0, 300) : ''),
    media: p.thumbnail?.startsWith('http') ? [p.thumbnail] : [],
    url: 'https://reddit.com' + p.permalink,
    likes: p.score || 0, comments: p.num_comments || 0, shares: 0,
    publishedAt: new Date(p.created_utc * 1000),
  }));
}

async function fetchTikTok(s) {
  const res = await fetch('https://open.tiktokapis.com/v2/video/list/?fields=id,title,cover_image_url,share_url,create_time,like_count,comment_count,share_count', {
    method: 'POST', body: JSON.stringify({ max_count: 20 }),
    headers: { Authorization: `Bearer ${s.accessToken}`, 'Content-Type': 'application/json' }
  });
  const d = await res.json();
  if (d.error?.code !== 'ok') throw new Error('TikTok: ' + (d.error?.message || 'Fetch failed'));
  return (d.data?.videos || []).map(v => ({
    externalId: 'tt_' + v.id,
    username: s.handle, displayName: s.displayName, avatar: s.avatar,
    content: v.title || '', media: [v.cover_image_url || ''],
    url: v.share_url || '#',
    likes: v.like_count || 0, comments: v.comment_count || 0, shares: v.share_count || 0,
    publishedAt: new Date((v.create_time || 0) * 1000),
  }));
}

// ─── UTILS ────────────────────────────────────────────────────────────────────
async function apiFetch(url, headers = {}) {
  const res = await fetch(url, { headers });
  return res.json();
}

async function postForm(url, form, extraHeaders = {}) {
  const res = await fetch(url, {
    method: 'POST', body: form,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...extraHeaders }
  });
  return res.json();
}

module.exports = { fetchPosts, getProfile, exchangeToken };
