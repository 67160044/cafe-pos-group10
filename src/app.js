require("dotenv").config();
const express = require("express");
const app = express();

app.use(express.json());
app.use(express.static("public"));

// Redirect root to frontend.html
app.get("/", (req, res) => {
  res.redirect("/frontend.html");
});

// API Routes
const orderRoutes = require("./routes/orderRoutes");
app.use("/api/orders", orderRoutes);

const menuRoutes = require("./routes/menuRoutes");
app.use("/api/menu", menuRoutes);

const reportRoutes = require("./routes/reportRoutes");
app.use("/api/reports", reportRoutes);

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
  console.log(`Cafe POS server running on port ${PORT}`);
});
