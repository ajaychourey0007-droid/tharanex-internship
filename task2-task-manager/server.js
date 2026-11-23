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

const Task = mongoose.model("Task", new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, default: "", trim: true },
  priority: { type: String, enum: ["low", "medium", "high"], default: "medium" },
  status: { type: String, enum: ["todo", "in-progress", "done"], default: "todo" },
  dueDate: Date,
}, { timestamps: true }));

// ---------- Auth ----------
const sign = (u) => jwt.sign({ id: u._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

function auth(req, res, next) {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  try {
    req.userId = jwt.verify(token, process.env.JWT_SECRET).id;
    next();
  } catch {
    res.status(401).json({ error: "Please log in" });
  }
}

app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) return res.status(400).json({ error: "All fields are required" });
    if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
    if (await User.findOne({ email: email.toLowerCase() })) return res.status(409).json({ error: "Email already registered" });
    const user = await User.create({ name, email, password: await bcrypt.hash(password, 10) });
    res.status(201).json({ token: sign(user), name: user.name });
  } catch { res.status(500).json({ error: "Registration failed" }); }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const user = await User.findOne({ email: (email || "").toLowerCase() });
    if (!user || !(await bcrypt.compare(password || "", user.password)))
      return res.status(401).json({ error: "Invalid email or password" });
    res.json({ token: sign(user), name: user.name });
  } catch { res.status(500).json({ error: "Login failed" }); }
});

// ---------- Tasks (CRUD, each user sees only their own) ----------
app.get("/api/tasks", auth, async (req, res) => {
  const filter = { user: req.userId };
  if (req.query.status) filter.status = req.query.status;
  res.json(await Task.find(filter).sort({ createdAt: -1 }));
});

app.post("/api/tasks", auth, async (req, res) => {
  const { title, description, priority, status, dueDate } = req.body || {};
  if (!title) return res.status(400).json({ error: "Title is required" });
  const task = await Task.create({ user: req.userId, title, description, priority, status, dueDate: dueDate || undefined });
  res.status(201).json(task);
});

app.put("/api/tasks/:id", auth, async (req, res) => {
  const { title, description, priority, status, dueDate } = req.body || {};
  const task = await Task.findOneAndUpdate(
    { _id: req.params.id, user: req.userId },
    { title, description, priority, status, dueDate: dueDate || null },
    { new: true, omitUndefined: true, runValidators: true }
  ).catch(() => null);
  if (!task) return res.status(404).json({ error: "Task not found" });
  res.json(task);
});

app.delete("/api/tasks/:id", auth, async (req, res) => {
  const task = await Task.findOneAndDelete({ _id: req.params.id, user: req.userId }).catch(() => null);
  if (!task) return res.status(404).json({ error: "Task not found" });
  res.json({ ok: true });
});

// ---------- Start ----------
const PORT = process.env.PORT || 3000;
if (!process.env.JWT_SECRET) { console.error("JWT_SECRET is missing in .env"); process.exit(1); }
mongoose.connect(process.env.MONGODB_URI)
  .then(() => app.listen(PORT, () => console.log(`Running on http://localhost:${PORT}`)))
  .catch((e) => { console.error("MongoDB connection failed:", e.message); process.exit(1); });
