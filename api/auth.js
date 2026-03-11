const { connectDB, User } = require('./_db');
const { signToken, hashPassword, checkPassword, json, err, cors, getToken, verifyToken } = require('./_helpers');
const { v4: uuidv4 } = require('uuid');

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  await connectDB();

  const route = req.query.action;

  // POST /api/auth?action=login
  if (req.method === 'POST' && route === 'login') {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !checkPassword(password, user.password))
      return err(res, 'Invalid credentials', 401);
    const token = signToken({ id: user._id.toString(), email: user.email, role: user.role });
    return json(res, { token, user: { id: user._id, email: user.email, name: user.name, role: user.role } });
  }

  // POST /api/auth?action=register
  if (req.method === 'POST' && route === 'register') {
    const { email, password, name } = req.body;
    if (await User.findOne({ email })) return err(res, 'Email already exists');
    const user = await User.create({ email, password: hashPassword(password), name });
    const token = signToken({ id: user._id.toString(), email: user.email, role: user.role });
    return json(res, { token, user: { id: user._id, email: user.email, name: user.name, role: user.role } });
  }

  // GET /api/auth?action=me
  if (req.method === 'GET' && route === 'me') {
    try {
      const payload = verifyToken(getToken(req));
      const user = await User.findById(payload.id);
      if (!user) return err(res, 'User not found', 404);
      return json(res, { id: user._id, email: user.email, name: user.name, role: user.role });
    } catch { return err(res, 'Unauthorized', 401); }
  }

  err(res, 'Not found', 404);
};
