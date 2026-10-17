// src/controllers/authController.js
const db = require("../config/db");
const { createToken } = require("../middleware/authMiddleware");

exports.login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: "กรุณาระบุ Email และ Password ให้ครบถ้วน",
    });
  }

  try {
    // ดึงข้อมูลจากตาราง user
    let [rows] = await db.query(
      `SELECT u.user_id, u.branch_id, u.name, u.email, u.password, u.role, b.name AS branch_name
       FROM \`user\` u
       LEFT JOIN branch b ON u.branch_id = b.branch_id
       WHERE u.email = ?`,
      [email.trim().toLowerCase()]
    );

    // Fallback เผื่อกรณี employee table
    if (rows.length === 0) {
      const [empRows] = await db.query(
        `SELECT e.employee_id AS user_id, e.branch_id, e.name, e.email, e.password, e.role, b.name AS branch_name
         FROM employee e
         LEFT JOIN branch b ON e.branch_id = b.branch_id
         WHERE e.email = ?`,
        [email.trim().toLowerCase()]
      );
      rows = empRows;
    }

    if (rows.length === 0) {
      return res.status(401).json({
        error: "ไม่พบอีเมลผู้ใช้งานนี้ในระบบ Whatever Cafe POS",
      });
    }

    const user = rows[0];

    // ตรวจสอบรหัสผ่าน
    if (user.password !== password) {
      return res.status(401).json({
        error: "รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง",
      });
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
