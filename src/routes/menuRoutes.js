// src/routes/menuRoutes.js
const express = require("express");
const router = express.Router();
const menuController = require("../controllers/menuController");
const { requireRole, authenticate } = require("../middleware/authMiddleware");

// ดูรายการเมนู (แคชเชียร์ พนักงาน หรือแอดมิน ดูได้)
router.get("/", authenticate, menuController.listMenu);
router.get("/:id", authenticate, menuController.getMenuById);

// เพิ่ม/แก้ไข/ลบ เมนู (ต้องมีสิทธิ์ admin หรือ manager เท่านั้น)
router.post("/", requireRole(["admin", "manager"]), menuController.createMenu);
router.put("/:id", requireRole(["admin", "manager"]), menuController.updateMenu);
router.delete("/:id", requireRole(["admin", "manager"]), menuController.deleteMenu);

module.exports = router;
