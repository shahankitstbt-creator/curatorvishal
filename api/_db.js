const mongoose = require('mongoose');

let isConnected = false;

async function connectDB() {
  if (isConnected) return;
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI environment variable is not set. Add it in Vercel project settings.');
  await mongoose.connect(process.env.MONGODB_URI);
  isConnected = true;
}

// ─── SCHEMAS ──────────────────────────────────────────────────────────────────

const UserSchema = new mongoose.Schema({
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  name: String,
  role: { type: String, default: 'user' },
  createdAt: { type: Date, default: Date.now }
});

const FeedSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  name: { type: String, required: true },
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
  apiKey: { type: String, unique: true },
  published: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const SourceSchema = new mongoose.Schema({
  feedId: { type: String, required: true },
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
  feedId: { type: String, required: true },
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
PostSchema.index({ feedId: 1, externalId: 1 }, { unique: false });

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
  createdAt: { type: Date, default: Date.now, expires: 600 } // auto-delete after 10 min
});

module.exports = {
  connectDB,
  User: mongoose.models.User || mongoose.model('User', UserSchema),
  Feed: mongoose.models.Feed || mongoose.model('Feed', FeedSchema),
  Source: mongoose.models.Source || mongoose.model('Source', SourceSchema),
  Post: mongoose.models.Post || mongoose.model('Post', PostSchema),
  Credential: mongoose.models.Credential || mongoose.model('Credential', CredentialSchema),
  OAuthState: mongoose.models.OAuthState || mongoose.model('OAuthState', OAuthStateSchema),
};
