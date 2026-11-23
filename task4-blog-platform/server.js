require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ---------- Models ----------
const User = mongoose.model("User", new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
}));

const Post = mongoose.model("Post", new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  content: { type: String, required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true }));

const Comment = mongoose.model("Comment", new mongoose.Schema({
  post: { type: mongoose.Schema.Types.ObjectId, ref: "Post", required: true, index: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  text: { type: String, required: true, trim: true, maxlength: 1000 },
}, { timestamps: true }));

// ---------- Auth ----------
const sign = (u) => jwt.sign({ id: u._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
function auth(req, res, next) {
  try {
    req.userId = jwt.verify((req.headers.authorization || "").replace("Bearer ", ""), process.env.JWT_SECRET).id;
    next();
  } catch { res.status(401).json({ error: "Please log in" }); }
}

app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) return res.status(400).json({ error: "All fields are required" });
    if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
    if (await User.findOne({ email: email.toLowerCase() })) return res.status(409).json({ error: "Email already registered" });
    const u = await User.create({ name, email, password: await bcrypt.hash(password, 10) });
    res.status(201).json({ token: sign(u), name: u.name, id: u._id });
  } catch { res.status(500).json({ error: "Registration failed" }); }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const u = await User.findOne({ email: (email || "").toLowerCase() });
    if (!u || !(await bcrypt.compare(password || "", u.password))) return res.status(401).json({ error: "Invalid email or password" });
    res.json({ token: sign(u), name: u.name, id: u._id });
  } catch { res.status(500).json({ error: "Login failed" }); }
});

// ---------- Posts ----------
app.get("/api/posts", async (_req, res) => {
  const posts = await Post.find().populate("author", "name").sort({ createdAt: -1 }).lean();
  const counts = await Comment.aggregate([{ $group: { _id: "$post", n: { $sum: 1 } } }]);
  const map = Object.fromEntries(counts.map((c) => [String(c._id), c.n]));
  res.json(posts.map((p) => ({ ...p, commentCount: map[String(p._id)] || 0 })));
});

app.get("/api/posts/:id", async (req, res) => {
  const post = await Post.findById(req.params.id).populate("author", "name").catch(() => null);
  post ? res.json(post) : res.status(404).json({ error: "Post not found" });
});

app.post("/api/posts", auth, async (req, res) => {
  const { title, content } = req.body || {};
  if (!title || !content) return res.status(400).json({ error: "Title and content are required" });
  res.status(201).json(await Post.create({ title, content, author: req.userId }));
});

app.put("/api/posts/:id", auth, async (req, res) => {
  const { title, content } = req.body || {};
  if (!title || !content) return res.status(400).json({ error: "Title and content are required" });
  const post = await Post.findOneAndUpdate({ _id: req.params.id, author: req.userId }, { title, content }, { new: true }).catch(() => null);
  post ? res.json(post) : res.status(404).json({ error: "Post not found or not yours" });
});

app.delete("/api/posts/:id", auth, async (req, res) => {
  const post = await Post.findOneAndDelete({ _id: req.params.id, author: req.userId }).catch(() => null);
  if (!post) return res.status(404).json({ error: "Post not found or not yours" });
  await Comment.deleteMany({ post: post._id });
  res.json({ ok: true });
});

// ---------- Comments ----------
app.get("/api/posts/:id/comments", async (req, res) => {
  try { res.json(await Comment.find({ post: req.params.id }).populate("author", "name").sort({ createdAt: 1 })); }
  catch { res.json([]); }
});

app.post("/api/posts/:id/comments", auth, async (req, res) => {
  const text = (req.body && req.body.text || "").trim();
  if (!text) return res.status(400).json({ error: "Comment cannot be empty" });
  const post = await Post.findById(req.params.id).catch(() => null);
  if (!post) return res.status(404).json({ error: "Post not found" });
  res.status(201).json(await Comment.create({ post: post._id, author: req.userId, text }));
});

// comment can be deleted by its author or by the post's author
app.delete("/api/comments/:id", auth, async (req, res) => {
  const c = await Comment.findById(req.params.id).populate("post").catch(() => null);
  if (!c) return res.status(404).json({ error: "Comment not found" });
  const allowed = String(c.author) === req.userId || (c.post && String(c.post.author) === req.userId);
  if (!allowed) return res.status(403).json({ error: "Not allowed" });
  await c.deleteOne();
  res.json({ ok: true });
});

// ---------- Start ----------
const PORT = process.env.PORT || 3000;
if (!process.env.JWT_SECRET) { console.error("JWT_SECRET is missing in .env"); process.exit(1); }
mongoose.connect(process.env.MONGODB_URI)
  .then(() => app.listen(PORT, () => console.log(`Running on http://localhost:${PORT}`)))
  .catch((e) => { console.error("MongoDB connection failed:", e.message); process.exit(1); });
