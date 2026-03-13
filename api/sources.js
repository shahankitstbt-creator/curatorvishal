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

  // feedId can be either _id or string id - try both
  const feed = await Feed.findOne({ $or: [{ _id: feedId }, { id: feedId }], userId: user.id }).lean().catch(() =>
    Feed.findOne({ userId: user.id }).lean()
  );
  if (!feed) return err(res, 'Feed not found', 404);
  const resolvedFeedId = feed._id.toString();

  if (req.method === 'GET') {
    const sources = await Source.find({ feedId: resolvedFeedId }).lean();
    return json(res, sources.map(s => ({ ...s, id: s._id.toString(), accessToken: s.accessToken ? '***' : '' })));
  }

  if (req.method === 'DELETE' && sourceId) {
    await Source.deleteOne({ _id: sourceId });
    await Post.deleteMany({ sourceId });
    return json(res, { success: true });
  }

  if (req.method === 'POST' && action === 'sync' && sourceId) {
    const source = await Source.findById(sourceId).lean();
    if (!source) return err(res, 'Source not found', 404);
    try {
      const posts = await fetchPosts(source);
      let added = 0;
      for (const p of posts) {
        const exists = await Post.findOne({ feedId: resolvedFeedId, externalId: p.externalId });
        if (!exists) {
          await Post.create({ ...p, feedId: resolvedFeedId, sourceId, platform: source.platform, published: true, pinned: false });
          added++;
        }
      }
      await Source.findByIdAndUpdate(sourceId, { lastSync: new Date() });
      return json(res, { success: true, newPosts: added });
    } catch (e) {
      return err(res, e.message);
    }
  }

  err(res, 'Method not allowed', 405);
};
