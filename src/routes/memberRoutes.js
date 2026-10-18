// src/routes/memberRoutes.js
const express = require("express");
const router = express.Router();
const memberController = require("../controllers/memberController");
const { requireRole } = require("../middleware/authMiddleware");

// ตรวจสอบ/สมัครสมาชิก: พนักงานหน้าร้าน (cashier) และ manager/admin
const frontDesk = requireRole(["cashier", "manager", "admin"]);

// ตรวจสอบสมาชิกจากเบอร์โทรศัพท์ (ต้องล็อกอินในระบบ POS ก่อน)
router.get("/check/:phone", frontDesk, memberController.checkMember);
router.get("/search", frontDesk, memberController.checkMember);

// รายชื่อสมาชิกทั้งหมด (ข้อมูลส่วนบุคคล) เฉพาะ manager/admin
router.get("/", requireRole(["manager", "admin"]), memberController.listMembers);

// สมัครสมาชิกใหม่ Cafe Club
router.post("/register", frontDesk, memberController.registerMember);

module.exports = router;
