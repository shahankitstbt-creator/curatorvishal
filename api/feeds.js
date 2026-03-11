const { connectDB, Feed } = require('./_db');
const { json, err, cors, getToken, verifyToken } = require('./_helpers');
const { v4: uuidv4 } = require('uuid');

async function getUser(req) {
  return verifyToken(getToken(req));
}

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  await connectDB();

  let user;
  try { user = await getUser(req); } catch { return err(res, 'Unauthorized', 401); }

  const { id } = req.query;

  // GET /api/feeds — list all
  if (req.method === 'GET' && !id) {
    const feeds = await Feed.find({ userId: user.id });
    return json(res, feeds);
  }

  // GET /api/feeds?id=xxx — get one
  if (req.method === 'GET' && id) {
    const feed = await Feed.findOne({ _id: id, userId: user.id });
    if (!feed) return err(res, 'Feed not found', 404);
    return json(res, feed);
  }

  // POST /api/feeds — create
  if (req.method === 'POST' && !id) {
    const feed = await Feed.create({
      userId: user.id,
      name: req.body.name,
      description: req.body.description || '',
      apiKey: uuidv4().replace(/-/g, ''),
    });
    return json(res, feed);
  }

  // PUT /api/feeds?id=xxx — update
  if (req.method === 'PUT' && id) {
    const feed = await Feed.findOneAndUpdate(
      { _id: id, userId: user.id },
      { ...req.body, updatedAt: new Date() },
      { new: true }
    );
    if (!feed) return err(res, 'Feed not found', 404);
    return json(res, feed);
  }

  // DELETE /api/feeds?id=xxx
  if (req.method === 'DELETE' && id) {
    await Feed.deleteOne({ _id: id, userId: user.id });
    const { Source, Post } = require('./_db');
    await Source.deleteMany({ feedId: id });
    await Post.deleteMany({ feedId: id });
    return json(res, { success: true });
  }

  err(res, 'Method not allowed', 405);
};
