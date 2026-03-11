const { connectDB } = require('./_db');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    await connectDB();
    res.status(200).json({ status: 'ok', mongodb: 'connected', time: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ status: 'error', mongodb: 'failed', error: e.message });
  }
};
