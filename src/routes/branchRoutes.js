// src/routes/branchRoutes.js
const express = require("express");
const router = express.Router();
const db = require("../config/db");

router.get("/branches", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM branch ORDER BY branch_id ASC");
    res.json(rows);
  } catch (err) {
    console.error("Get Branches Error:", err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลสาขา" });
  }
});

router.get("/categories", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM category ORDER BY category_id ASC");
    res.json(rows);
  } catch (err) {
    console.error("Get Categories Error:", err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลหมวดหมู่" });
  }
});

module.exports = router;
