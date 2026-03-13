const { connectDB, Feed, Source, Post } = require('./_db');
const { json, err, cors, getToken, verifyToken } = require('./_helpers');
const { v4: uuidv4 } = require('uuid');

function fixId(doc) {
  if (!doc) return doc;
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  obj.id = obj._id ? obj._id.toString() : obj.id;
  return obj;
}

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  await connectDB();

  let user;
  try { user = verifyToken(getToken(req)); } catch { return err(res, 'Unauthorized', 401); }

  const { id } = req.query;

  if (req.method === 'GET' && !id) {
    const feeds = await Feed.find({ userId: user.id }).lean();
    return json(res, feeds.map(f => ({ ...f, id: f._id.toString() })));
  }

  if (req.method === 'GET' && id) {
    const feed = await Feed.findOne({ _id: id, userId: user.id }).lean();
    if (!feed) return err(res, 'Feed not found', 404);
    return json(res, { ...feed, id: feed._id.toString() });
  }

  if (req.method === 'POST') {
    const feed = await Feed.create({
      userId: user.id,
      name: req.body.name,
      description: req.body.description || '',
      apiKey: uuidv4().replace(/-/g, ''),
    });
    const obj = feed.toObject();
    return json(res, { ...obj, id: obj._id.toString() });
  }

  if (req.method === 'PUT' && id) {
    const feed = await Feed.findOneAndUpdate(
      { _id: id, userId: user.id },
      { ...req.body, updatedAt: new Date() },
      { new: true }
    ).lean();
    if (!feed) return err(res, 'Feed not found', 404);
    return json(res, { ...feed, id: feed._id.toString() });
  }

  if (req.method === 'DELETE' && id) {
    await Feed.deleteOne({ _id: id, userId: user.id });
    await Source.deleteMany({ feedId: id });
    await Post.deleteMany({ feedId: id });
    return json(res, { success: true });
  }

  err(res, 'Method not allowed', 405);
};
