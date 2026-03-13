const { connectDB, Feed, Post } = require('./_db');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  await connectDB();

  const { apiKey } = req.query;
  if (!apiKey) return res.status(400).json({ error: 'API key required' });

  const feed = await Feed.findOne({ apiKey }).lean();
  if (!feed) return res.status(404).json({ error: 'Feed not found. Check your API key.' });
  if (!feed.published) return res.status(403).json({ error: 'Feed is not published. Open admin → Publish & Embed → toggle Live.' });

  const posts = await Post.find({ feedId: feed._id.toString(), published: true })
    .sort({ pinned: -1, publishedAt: -1 })
    .limit(feed.maxPosts || 20)
    .lean();

  res.status(200).json({
    feed: { id: feed._id, name: feed.name, theme: feed.theme, layout: feed.layout, columns: feed.columns, gap: feed.gap, cardRadius: feed.cardRadius, showAvatar: feed.showAvatar, showUsername: feed.showUsername, showCaption: feed.showCaption, showPlatform: feed.showPlatform, showDate: feed.showDate },
    posts,
  });
};
