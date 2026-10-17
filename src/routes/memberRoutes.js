// src/routes/memberRoutes.js
const express = require("express");
const router = express.Router();
const memberController = require("../controllers/memberController");
const { authenticate } = require("../middleware/authMiddleware");

// ตรวจสอบสมาชิกจากเบอร์โทรศัพท์ (ต้องล็อกอินในระบบ POS ก่อน)
router.get("/check/:phone", authenticate, memberController.checkMember);
router.get("/search", authenticate, memberController.checkMember);

// รายชื่อสมาชิกทั้งหมด
router.get("/", authenticate, memberController.listMembers);

// สมัครสมาชิกใหม่ Cafe Club
router.post("/register", authenticate, memberController.registerMember);

module.exports = router;
