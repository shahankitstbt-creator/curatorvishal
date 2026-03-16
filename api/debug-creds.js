const { connectDB, Credential } = require('./_db');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  await connectDB();
  const all = await Credential.find({}).lean();
  res.json({ count: all.length, credentials: all.map(c => ({
    _id: c._id, userId: c.userId, platform: c.platform,
    hasClientId: !!c.clientId, clientIdStart: c.clientId ? c.clientId.substring(0,8) : null,
    hasSecret: !!c.clientSecret
  }))});
};
