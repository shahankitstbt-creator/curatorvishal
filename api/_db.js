const mongoose = require('mongoose');

let isConnected = false;

async function connectDB() {
  if (isConnected) return;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set in Vercel Environment Variables. Go to Vercel → Project Settings → Environment Variables and add it.');
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    isConnected = true;
  } catch (e) {
    throw new Error('MongoDB connection failed: ' + e.message);
  }
}

const UserSchema = new mongoose.Schema({
  email: { type: String, unique: true, required: true },
  password: String,
  name: String,
  role: { type: String, default: 'user' },
  createdAt: { type: Date, default: Date.now }
});

const FeedSchema = new mongoose.Schema({
  userId: String,
  name: String,
  description: String,
  theme: { type: String, default: 'dark' },
  layout: { type: String, default: 'grid' },
  columns: { type: Number, default: 3 },
  gap: { type: Number, default: 16 },
  cardRadius: { type: Number, default: 12 },
  showAvatar: { type: Boolean, default: true },
  showUsername: { type: Boolean, default: true },
  showCaption: { type: Boolean, default: true },
  showPlatform: { type: Boolean, default: true },
  showDate: { type: Boolean, default: true },
  maxPosts: { type: Number, default: 20 },
  apiKey: { type: String, unique: true, sparse: true },
  published: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const SourceSchema = new mongoose.Schema({
  feedId: String,
  userId: String,
  platform: String,
  type: { type: String, default: 'profile' },
  handle: String,
  displayName: String,
  avatar: String,
  accessToken: String,
  refreshToken: String,
  platformUserId: String,
  status: { type: String, default: 'connected' },
  lastSync: Date,
  createdAt: { type: Date, default: Date.now }
});

const PostSchema = new mongoose.Schema({
  feedId: String,
  sourceId: String,
  platform: String,
  externalId: String,
  username: String,
  displayName: String,
  avatar: String,
  content: String,
  media: [String],
  url: String,
  likes: { type: Number, default: 0 },
  comments: { type: Number, default: 0 },
  shares: { type: Number, default: 0 },
  publishedAt: Date,
  published: { type: Boolean, default: true },
  pinned: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const CredentialSchema = new mongoose.Schema({
  userId: String,
  platform: String,
  clientId: String,
  clientSecret: String,
  bearerToken: String
});

const OAuthStateSchema = new mongoose.Schema({
  state: { type: String, unique: true },
  data: String,
  pkce: String,
  createdAt: { type: Date, default: Date.now, expires: 600 }
});

module.exports = {
  connectDB,
  User:       mongoose.models.User       || mongoose.model('User', UserSchema),
  Feed:       mongoose.models.Feed       || mongoose.model('Feed', FeedSchema),
  Source:     mongoose.models.Source     || mongoose.model('Source', SourceSchema),
  Post:       mongoose.models.Post       || mongoose.model('Post', PostSchema),
  Credential: mongoose.models.Credential || mongoose.model('Credential', CredentialSchema),
  OAuthState: mongoose.models.OAuthState || mongoose.model('OAuthState', OAuthStateSchema),
};
