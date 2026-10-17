require("dotenv").config();
const path = require("path");
const express = require("express");
const app = express();

app.use(express.json());
app.use(express.static("public"));

// Page Routes (Multi-Page Architecture)
app.get("/", (req, res) => {
  res.redirect("/login.html");
});

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/login.html"));
});

app.get("/order", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/order.html"));
});

app.get("/menu", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/menu.html"));
});

app.get("/report", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/report.html"));
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/admin.html"));
});

app.get("/barista", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/barista.html"));
});

// API Routes
const authRoutes = require("./routes/authRoutes");
app.use("/api/auth", authRoutes);

const branchRoutes = require("./routes/branchRoutes");
app.use("/api", branchRoutes);

const orderRoutes = require("./routes/orderRoutes");
app.use("/api/orders", orderRoutes);

const menuRoutes = require("./routes/menuRoutes");
app.use("/api/menu", menuRoutes);

const reportRoutes = require("./routes/reportRoutes");
app.use("/api/reports", reportRoutes);

const memberRoutes = require("./routes/memberRoutes");
app.use("/api/members", memberRoutes);

const adminRoutes = require("./routes/adminRoutes");
app.use("/api/admin", adminRoutes);

// 404 Handler for undefined API routes
app.use("/api/*", (req, res) => {
  res.status(404).json({ error: "API endpoint not found" });
});

// Global Error Handler Middleware
app.use((err, req, res, next) => {
  console.error("Unhandled Error:", err);
  res.status(500).json({ error: "Internal Server Error" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`☕ Whatever Cafe POS Server running on http://localhost:${PORT}`);
});
