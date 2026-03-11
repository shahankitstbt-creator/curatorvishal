const { connectDB, Feed, Source, Post } = require('./_db');
const { json, err, cors, getToken, verifyToken } = require('./_helpers');
const { fetchPosts } = require('./_fetchers');

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  await connectDB();

  let user;
  try { user = verifyToken(getToken(req)); } catch { return err(res, 'Unauthorized', 401); }

  const { feedId, sourceId, action } = req.query;

  // Verify feed ownership
  const feed = await Feed.findOne({ _id: feedId, userId: user.id });
  if (!feed) return err(res, 'Feed not found', 404);

  // GET /api/sources?feedId=xxx
  if (req.method === 'GET') {
    const sources = await Source.find({ feedId }).lean();
    return json(res, sources.map(s => ({ ...s, accessToken: s.accessToken ? '***' : '' })));
  }

  // DELETE /api/sources?feedId=xxx&sourceId=yyy
  if (req.method === 'DELETE' && sourceId) {
    await Source.deleteOne({ _id: sourceId, feedId });
    await Post.deleteMany({ sourceId });
    return json(res, { success: true });
  }

  // POST /api/sources?feedId=xxx&action=sync&sourceId=yyy  — manual sync
  if (req.method === 'POST' && action === 'sync' && sourceId) {
    const source = await Source.findOne({ _id: sourceId, feedId }).lean();
    if (!source) return err(res, 'Source not found', 404);
    try {
      const posts = await fetchPosts(source);
      let added = 0;
      for (const p of posts) {
        const exists = await Post.findOne({ feedId, externalId: p.externalId });
        if (!exists) { await Post.create({ ...p, feedId, sourceId, platform: source.platform }); added++; }
      }
      await Source.updateOne({ _id: sourceId }, { lastSync: new Date() });
      return json(res, { success: true, newPosts: added });
    } catch (e) {
      return err(res, e.message);
    }
  }

  err(res, 'Method not allowed', 405);
};
