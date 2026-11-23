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
  role: { type: String, enum: ["user", "admin"], default: "user" },
}));

const Product = mongoose.model("Product", new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: "" },
  price: { type: Number, required: true, min: 0 },
  stock: { type: Number, default: 0, min: 0 },
  image: { type: String, default: "" },
  category: { type: String, default: "General" },
}, { timestamps: true }));

const Order = mongoose.model("Order", new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  items: [{ product: mongoose.Schema.Types.ObjectId, name: String, price: Number, qty: Number }],
  total: Number,
  address: String,
  status: { type: String, enum: ["placed", "packed", "shipped", "delivered", "cancelled"], default: "placed" },
}, { timestamps: true }));

// ---------- Auth helpers ----------
const sign = (u) => jwt.sign({ id: u._id, role: u.role }, process.env.JWT_SECRET, { expiresIn: "7d" });

function auth(req, res, next) {
  try {
    const t = (req.headers.authorization || "").replace("Bearer ", "");
    const p = jwt.verify(t, process.env.JWT_SECRET);
    req.userId = p.id; req.role = p.role;
    next();
  } catch { res.status(401).json({ error: "Please log in" }); }
}
const adminOnly = (req, res, next) => req.role === "admin" ? next() : res.status(403).json({ error: "Admin access only" });

// ---------- Auth routes (first registered user becomes Admin) ----------
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) return res.status(400).json({ error: "All fields are required" });
    if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
    if (await User.findOne({ email: email.toLowerCase() })) return res.status(409).json({ error: "Email already registered" });
    const role = (await User.countDocuments()) === 0 ? "admin" : "user";
    const u = await User.create({ name, email, role, password: await bcrypt.hash(password, 10) });
    res.status(201).json({ token: sign(u), name: u.name, role: u.role });
  } catch { res.status(500).json({ error: "Registration failed" }); }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const u = await User.findOne({ email: (email || "").toLowerCase() });
    if (!u || !(await bcrypt.compare(password || "", u.password))) return res.status(401).json({ error: "Invalid email or password" });
    res.json({ token: sign(u), name: u.name, role: u.role });
  } catch { res.status(500).json({ error: "Login failed" }); }
});

// ---------- Products ----------
app.get("/api/products", async (req, res) => {
  const q = req.query.search ? { name: new RegExp(req.query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") } : {};
  res.json(await Product.find(q).sort({ createdAt: -1 }));
});

app.post("/api/products", auth, adminOnly, async (req, res) => {
  try { res.status(201).json(await Product.create(req.body)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

app.put("/api/products/:id", auth, adminOnly, async (req, res) => {
  try {
    const p = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    p ? res.json(p) : res.status(404).json({ error: "Product not found" });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete("/api/products/:id", auth, adminOnly, async (req, res) => {
  const p = await Product.findByIdAndDelete(req.params.id).catch(() => null);
  p ? res.json({ ok: true }) : res.status(404).json({ error: "Product not found" });
});

// ---------- Orders ----------
app.post("/api/orders", auth, async (req, res) => {
  try {
    const { items, address } = req.body || {};
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: "Cart is empty" });
    if (!address || !address.trim()) return res.status(400).json({ error: "Delivery address is required" });
    const lines = [];
    let total = 0;
    for (const it of items) {
      const qty = parseInt(it.qty, 10);
      const p = await Product.findById(it.productId).catch(() => null);
      if (!p || !(qty > 0)) return res.status(400).json({ error: "Invalid item in cart" });
      if (p.stock < qty) return res.status(400).json({ error: `Only ${p.stock} left of ${p.name}` });
      lines.push({ product: p._id, name: p.name, price: p.price, qty });
      total += p.price * qty;
    }
    for (const l of lines) await Product.updateOne({ _id: l.product }, { $inc: { stock: -l.qty } });
    res.status(201).json(await Order.create({ user: req.userId, items: lines, total, address }));
  } catch { res.status(500).json({ error: "Could not place order" }); }
});

app.get("/api/orders/mine", auth, async (req, res) => {
  res.json(await Order.find({ user: req.userId }).sort({ createdAt: -1 }));
});

app.get("/api/orders", auth, adminOnly, async (_req, res) => {
  res.json(await Order.find().populate("user", "name email").sort({ createdAt: -1 }));
});

app.put("/api/orders/:id/status", auth, adminOnly, async (req, res) => {
  try {
    const o = await Order.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true, runValidators: true });
    o ? res.json(o) : res.status(404).json({ error: "Order not found" });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ---------- Start (seeds sample products on first run) ----------
const sample = [
  { name: "Wireless Earbuds", description: "Bluetooth 5.3, 24h battery", price: 1499, stock: 25, category: "Electronics" },
  { name: "Mechanical Keyboard", description: "RGB, blue switches", price: 2999, stock: 15, category: "Electronics" },
  { name: "Backpack", description: "Water-resistant, 30L", price: 1199, stock: 30, category: "Fashion" },
  { name: "Notebook Pack (5)", description: "A5 ruled notebooks", price: 349, stock: 100, category: "Stationery" },
];
const PORT = process.env.PORT || 3000;
if (!process.env.JWT_SECRET) { console.error("JWT_SECRET is missing in .env"); process.exit(1); }
mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    if ((await Product.countDocuments()) === 0) await Product.insertMany(sample);
    app.listen(PORT, () => console.log(`Running on http://localhost:${PORT}`));
  })
  .catch((e) => { console.error("MongoDB connection failed:", e.message); process.exit(1); });
