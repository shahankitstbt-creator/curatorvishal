const { connectDB, Source, Post } = require('./_db');
const { fetchPosts } = require('./_fetchers');
const { cors, getToken, verifyToken } = require('./_helpers');
const fetch = require('node-fetch');

module.exports = async (req, res) => {
  cors(res);
  await connectDB();

  let user;
  try { user = verifyToken(getToken(req)); } catch { return res.status(401).json({ error: 'Unauthorized' }); }

  const { feedId } = req.query;
  const sources = await Source.find({ feedId }).lean();
  if (!sources.length) return res.json({ message: 'No sources found', feedId });

  const results = [];
  for (const source of sources) {
    const result = { platform: source.platform, handle: source.handle };

    if (source.platform === 'youtube') {
      // Raw API debug
      try {
        const chRes = await fetch(
          'https://www.googleapis.com/youtube/v3/channels?part=contentDetails,snippet&mine=true',
          { headers: { Authorization: `Bearer ${source.accessToken}` } }
        );
        const chData = await chRes.json();
        result.rawChannelResponse = chData;
        result.uploadsPlaylistId = chData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
        result.channelTitle = chData.items?.[0]?.snippet?.title;
        result.totalChannels = chData.items?.length;

        if (result.uploadsPlaylistId) {
          const plRes = await fetch(
            `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${result.uploadsPlaylistId}&maxResults=5`,
            { headers: { Authorization: `Bearer ${source.accessToken}` } }
          );
          const plData = await plRes.json();
          result.playlistItemCount = plData.pageInfo?.totalResults;
          result.firstVideoTitle = plData.items?.[0]?.snippet?.title;
          result.playlistError = plData.error?.message;
        }
      } catch(e) {
        result.debugError = e.message;
      }
    }

    try {
      const posts = await fetchPosts(source);
      result.fetched = posts.length;
      result.firstPost = posts[0] || null;

      let added = 0;
      for (const p of posts) {
        const exists = await Post.findOne({ feedId, externalId: p.externalId });
        if (!exists) {
          await Post.create({ ...p, feedId, sourceId: source._id.toString(), platform: source.platform, published: true, pinned: false });
          added++;
        }
      }
      result.added = added;
      result.status = 'ok';
    } catch (e) {
      result.status = 'error';
      result.error = e.message;
    }
    results.push(result);
  }

  res.json({ results, totalPostsInDB: await Post.countDocuments({ feedId }) });
};
