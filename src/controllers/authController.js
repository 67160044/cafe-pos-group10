// src/controllers/authController.js
const db = require("../config/db");
const { createToken } = require("../middleware/authMiddleware");
const { verifyPassword, hashPassword, isHashed } = require("../utils/password");

// จำกัดจำนวนครั้งที่ล็อกอินผิดต่อ (IP + อีเมล) เก็บในหน่วยความจำของ process
// (รีสตาร์ตเซิร์ฟเวอร์แล้วนับใหม่ เหมาะกับโครงงานขนาดเล็กที่รันเครื่องเดียว)
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_WINDOW_MS = 15 * 60 * 1000;
const failedAttempts = new Map(); // key -> { count, firstAt }

const LOGIN_FAILED_MESSAGE = "อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง";
// hash ปลอมไว้เทียบรหัสผ่านเมื่อไม่พบอีเมล เพื่อให้เวลาตอบใกล้เคียงกรณีพบอีเมล
const DUMMY_HASH = hashPassword("dummy-password-for-timing");

function attemptKey(req, email) {
  return `${req.ip || "unknown"}|${email}`;
}

function isLocked(key) {
  const rec = failedAttempts.get(key);
  if (!rec) return false;
  if (Date.now() - rec.firstAt > LOCK_WINDOW_MS) {
    failedAttempts.delete(key);
    return false;
  }
  return rec.count >= MAX_FAILED_ATTEMPTS;
}

function recordFailure(key) {
  const rec = failedAttempts.get(key);
  if (!rec || Date.now() - rec.firstAt > LOCK_WINDOW_MS) {
    failedAttempts.set(key, { count: 1, firstAt: Date.now() });
  } else {
    rec.count += 1;
  }
}

exports.login = async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({
      error: "กรุณาระบุ Email และ Password ให้ครบถ้วน",
    });
  }
  if (typeof email !== "string" || typeof password !== "string") {
    return res.status(400).json({
      error: "ชนิดข้อมูลของ Email และ Password ไม่ถูกต้อง",
    });
  }

  const cleanEmail = email.trim().toLowerCase();
  const key = attemptKey(req, cleanEmail);
  if (isLocked(key)) {
    return res.status(429).json({
      error: "ล็อกอินผิดหลายครั้งเกินกำหนด กรุณารอ 15 นาทีแล้วลองใหม่อีกครั้ง",
    });
  }

  try {
    // ดึงข้อมูลจากตาราง user (schema ปัจจุบันไม่มีตาราง employee แล้ว)
    const [rows] = await db.query(
      `SELECT u.user_id, u.branch_id, u.name, u.email, u.password, u.role, b.name AS branch_name
       FROM \`user\` u
       LEFT JOIN branch b ON u.branch_id = b.branch_id
       WHERE u.email = ?`,
      [cleanEmail]
    );

    const user = rows[0];

    // ตอบข้อความเดียวกันทั้งกรณีไม่พบอีเมลและรหัสผ่านผิด ไม่เปิดเผยว่าอีเมลใดมีในระบบ
    if (!user) {
      verifyPassword(password, DUMMY_HASH);
      recordFailure(key);
      return res.status(401).json({ error: LOGIN_FAILED_MESSAGE });
    }

    if (!verifyPassword(password, user.password)) {
      recordFailure(key);
      return res.status(401).json({ error: LOGIN_FAILED_MESSAGE });
    }

    failedAttempts.delete(key);

    // อัปเกรดรหัสผ่านเดิมที่ยังเป็น plaintext ให้เป็น hash เมื่อล็อกอินสำเร็จ
    if (!isHashed(user.password)) {
      try {
        await db.query("UPDATE `user` SET password = ? WHERE user_id = ?", [
          hashPassword(password),
          user.user_id,
        ]);
      } catch (e) {
        console.warn("Could not upgrade password hash:", e.message);
      }
    }

    const userPayload = {
      userId: user.user_id,
      employeeId: user.user_id, // เพื่อ compatibility
      name: user.name,
      email: user.email,
      role: user.role,
      branchId: user.branch_id,
      branchName: user.branch_name,
    };

    const token = createToken(userPayload);

    return res.json({
      success: true,
      message: "เข้าสู่ระบบ Whatever Cafe POS สำเร็จ",
      token,
      user: {
        userId: user.user_id,
        employeeId: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role,
        branchId: user.branch_id,
        branchName: user.branch_name,
      },
    });
  } catch (err) {
    console.error("Login Error:", err);
    return res.status(500).json({
      error: "เกิดข้อผิดพลาดในการเข้าสู่ระบบ Whatever Cafe POS",
    });
  }
};

exports.getMe = async (req, res) => {
  return res.json({
    user: req.user,
  });
};

exports.listUsers = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT u.user_id, u.branch_id, u.name, u.email, u.role, b.name AS branch_name
       FROM \`user\` u
       LEFT JOIN branch b ON u.branch_id = b.branch_id
       ORDER BY u.user_id ASC`
    );
    return res.json(rows);
  } catch (err) {
    console.error("List Users Error:", err);
    return res.status(500).json({
      error: "เกิดข้อผิดพลาดในการดึงข้อมูลผู้ใช้งาน",
    });
  }
};
