// src/routes/menuRoutes.js
const express = require("express");
const router = express.Router();
const menuController = require("../controllers/menuController");
const { requireRole, requireAuth } = require("../middleware/authMiddleware");

// ดูรายการเมนู (แคชเชียร์ พนักงาน หรือแอดมิน ดูได้)
router.get("/", requireAuth, menuController.listMenu);
router.get("/:id", requireAuth, menuController.getMenuById);

// เพิ่ม/แก้ไข/ลบ เมนู (ต้องมีสิทธิ์ admin หรือ manager เท่านั้น)
router.post("/", requireRole(["admin", "manager"]), menuController.createMenu);
router.put("/:id", requireRole(["admin", "manager"]), menuController.updateMenu);
// แก้ไขบางฟิลด์ตามหลัก REST (PATCH) ใช้ handler เดียวกับ PUT ที่หน้าจอเดิมเรียกใช้
router.patch("/:id", requireRole(["admin", "manager"]), menuController.updateMenu);
router.delete("/:id", requireRole(["admin", "manager"]), menuController.deleteMenu);

module.exports = router;
