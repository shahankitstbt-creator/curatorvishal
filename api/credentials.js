const { connectDB, Credential } = require('./_db');
const { json, err, cors, getToken, verifyToken } = require('./_helpers');

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  await connectDB();

  let user;
  try { user = verifyToken(getToken(req)); } catch { return err(res, 'Unauthorized', 401); }

  if (req.method === 'GET') {
    const creds = await Credential.find({ userId: user.id }).lean();
    return json(res, creds.map(c => ({
      platform: c.platform,
      clientId: c.clientId ? c.clientId.substring(0, 6) + '...' : '',
      hasSecret: !!c.clientSecret,
    })));
  }

  if (req.method === 'POST') {
    const { platform, clientId, clientSecret, bearerToken } = req.body;
    if (!platform || !clientId) return err(res, 'platform and clientId required');
    await Credential.findOneAndUpdate(
      { userId: user.id, platform },
      { userId: user.id, platform, clientId, clientSecret: clientSecret || '', bearerToken: bearerToken || '' },
      { upsert: true }
    );
    return json(res, { success: true });
  }

  err(res, 'Method not allowed', 405);
};
