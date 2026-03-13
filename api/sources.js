const { connectDB, Feed, Source, Post } = require('./_db');
const { json, err, cors, getToken, verifyToken } = require('./_helpers');
const { fetchPosts } = require('./_fetchers');
const mongoose = require('mongoose');

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  await connectDB();

  let user;
  try { user = verifyToken(getToken(req)); } catch { return err(res, 'Unauthorized', 401); }

  const { feedId, sourceId, action } = req.query;

  // Find feed - handle both string id and ObjectId
  let feed;
  try { feed = await Feed.findOne({ _id: feedId, userId: user.id }).lean(); } catch(e) {}
  if (!feed) return err(res, 'Feed not found', 404);

  if (req.method === 'GET') {
    const sources = await Source.find({ feedId }).lean();
    return json(res, sources.map(s => ({ ...s, id: s._id.toString(), accessToken: s.accessToken ? '***' : '' })));
  }

  if (req.method === 'DELETE' && sourceId) {
    await Source.deleteOne({ _id: sourceId });
    await Post.deleteMany({ sourceId });
    return json(res, { success: true });
  }

  if (req.method === 'POST' && action === 'sync' && sourceId) {
    // Get source WITH the real access token (don't use lean masked version)
    let source;
    try { source = await Source.findById(sourceId).lean(); } catch(e) {}
    if (!source) return err(res, 'Source not found: ' + sourceId, 404);

    console.log(`[sync] platform=${source.platform} feedId=${feedId} hasToken=${!!source.accessToken}`);

    try {
      const posts = await fetchPosts(source);
      console.log(`[sync] fetched ${posts.length} posts from ${source.platform}`);

      let added = 0;
      for (const p of posts) {
        const exists = await Post.findOne({ feedId, externalId: p.externalId });
        if (!exists) {
          await Post.create({
            ...p,
            feedId,
            sourceId: source._id.toString(),
            platform: source.platform,
            published: true,
            pinned: false,
          });
          added++;
        }
      }
      await Source.findByIdAndUpdate(sourceId, { lastSync: new Date() });
      console.log(`[sync] added ${added} new posts`);
      return json(res, { success: true, newPosts: added, totalFetched: posts.length });
    } catch (e) {
      console.error(`[sync] error:`, e.message);
      return err(res, e.message);
    }
  }

  err(res, 'Method not allowed', 405);
};
