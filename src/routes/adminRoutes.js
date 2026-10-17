// src/routes/adminRoutes.js
const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const { authenticate, requireRole } = require("../middleware/authMiddleware");

// ทุก Route ใน Admin ต้องผ่านการยืนยันตัวตน และต้องมีบทบาท 'admin' เท่านั้น
router.use(authenticate, requireRole(["admin"]));

// 1. จัดการพนักงาน (ยกเว้น Manager)
router.get("/staff", adminController.listStaff);
router.post("/staff", adminController.createStaff);
router.put("/staff/:id", adminController.updateStaff);
router.delete("/staff/:id", adminController.deleteStaff);

// 2. จัดการระบบสมาชิกและโปรโมชั่น
router.get("/members", adminController.listMembers);
router.post("/members", adminController.createMember);
router.put("/members/:id", adminController.updateMember);
router.delete("/members/:id", adminController.deleteMember);

// 3. จัดการสาขาและข้อมูลร้าน
router.get("/branches", adminController.listBranches);
router.post("/branches", adminController.createBranch);
router.put("/branches/:id", adminController.updateBranch);

module.exports = router;
