// src/routes/reportRoutes.js
const express = require("express");
const router = express.Router();
const reportController = require("../controllers/reportController");
const { requireRole } = require("../middleware/authMiddleware");

// ดูรายงานยอดขาย (สงวนสิทธิ์เฉพาะผู้จัดการร้าน Manager เท่านั้น Admin และ Cashier ไม่มีสิทธิ์เข้าถึง)
router.get("/sales", requireRole(["manager"]), reportController.getSalesReport);

module.exports = router;
