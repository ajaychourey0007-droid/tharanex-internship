require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const mongoose = require("mongoose");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ---------- Database models ----------
const Project = mongoose.model("Project", new mongoose.Schema({
  title: String,
  description: String,
  tech: [String],
  github: String,
  live: String,
}));

const Message = mongoose.model("Message", new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true },
  message: { type: String, required: true, trim: true },
  createdAt: { type: Date, default: Date.now },
}));

// Starter data (edit these to your real projects)
const seedProjects = [
  { title: "Personal Portfolio Website", description: "This full-stack portfolio: frontend, REST API and MongoDB database.", tech: ["HTML", "CSS", "JavaScript", "Node.js", "MongoDB"], github: "https://github.com/", live: "#" },
  { title: "Growfinix Internship Work", description: "Responsive frontend pages built during my Frontend Development internship.", tech: ["HTML", "CSS", "JavaScript"], github: "https://github.com/", live: "#" },
  { title: "To-Do List App", description: "Add, complete and delete tasks with local persistence.", tech: ["JavaScript", "CSS"], github: "https://github.com/", live: "#" },
];

// ---------- API routes ----------
app.get("/api/projects", async (_req, res) => {
  try { res.json(await Project.find().sort({ _id: 1 })); }
  catch { res.status(500).json({ error: "Could not load projects" }); }
});

app.post("/api/contact", async (req, res) => {
  const { name, email, message } = req.body || {};
  if (!name || !email || !message) return res.status(400).json({ error: "All fields are required" });
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: "Invalid email" });
  try {
    await Message.create({ name, email, message });
    res.status(201).json({ ok: true });
  } catch { res.status(500).json({ error: "Could not save message" }); }
});

// ---------- Start ----------
const PORT = process.env.PORT || 3000;
mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    if ((await Project.countDocuments()) === 0) await Project.insertMany(seedProjects);
    app.listen(PORT, () => console.log(`Running on http://localhost:${PORT}`));
  })
  .catch((e) => { console.error("MongoDB connection failed:", e.message); process.exit(1); });
