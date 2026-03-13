const { connectDB, Feed, Post } = require('./_db');
const { json, err, cors, getToken, verifyToken } = require('./_helpers');

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  await connectDB();

  let user;
  try { user = verifyToken(getToken(req)); } catch { return err(res, 'Unauthorized', 401); }

  const { feedId, postId } = req.query;
  const feed = await Feed.findOne({ _id: feedId, userId: user.id });
  if (!feed) return err(res, 'Feed not found', 404);

  if (req.method === 'GET') {
    const posts = await Post.find({ feedId })
      .sort({ pinned: -1, publishedAt: -1 })
      .lean();
    return json(res, posts);
  }

  if (req.method === 'POST') {
    const post = await Post.create({ ...req.body, feedId });
    return json(res, post);
  }

  if (req.method === 'PUT' && postId) {
    const post = await Post.findByIdAndUpdate(postId, req.body, { new: true });
    if (!post) return err(res, 'Post not found', 404);
    return json(res, post);
  }

  if (req.method === 'DELETE' && postId) {
    await Post.deleteOne({ _id: postId });
    return json(res, { success: true });
  }

  err(res, 'Method not allowed', 405);
};
