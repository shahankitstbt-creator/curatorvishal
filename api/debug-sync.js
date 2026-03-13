const { connectDB, Source, Post } = require('./_db');
const { fetchPosts } = require('./_fetchers');
const { cors, getToken, verifyToken } = require('./_helpers');

module.exports = async (req, res) => {
  cors(res);
  await connectDB();

  let user;
  try { user = verifyToken(getToken(req)); } catch { return res.status(401).json({ error: 'Unauthorized' }); }

  const { feedId } = req.query;

  // Get all sources for this feed with real tokens
  const sources = await Source.find({ feedId }).lean();

  if (!sources.length) return res.json({ message: 'No sources found for this feed', feedId });

  const results = [];
  for (const source of sources) {
    const result = { platform: source.platform, handle: source.handle, sourceId: source._id };
    try {
      const posts = await fetchPosts(source);
      result.fetched = posts.length;
      result.sample = posts[0] || null;

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

  const totalPosts = await Post.countDocuments({ feedId });
  res.json({ results, totalPostsInDB: totalPosts });
};
