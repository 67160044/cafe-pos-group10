// src/controllers/adminController.js
const db = require("../config/db");
const { hashPassword } = require("../utils/password");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;
const ALLOWED_DISCOUNT_RATES = [0, 0.05, 0.1, 0.15];
const isPositiveInt = (v) => Number.isInteger(v) && v > 0;

async function branchExists(branchId) {
  const [rows] = await db.query("SELECT branch_id FROM branch WHERE branch_id = ?", [branchId]);
  return rows.length > 0;
}

// ตรวจ points และ discountRate ของสมาชิก คืนข้อความ error หรือ null
function validateMemberNumbers(points, discountRate) {
  if (!Number.isInteger(points) || points < 0 || points > 10000000) {
    return "แต้มสะสมต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป";
  }
  if (!ALLOWED_DISCOUNT_RATES.some((r) => Math.abs(r - discountRate) < 1e-9)) {
    return "ส่วนลดสมาชิกต้องเป็น 0%, 5%, 10% หรือ 15% เท่านั้น";
  }
  return null;
}

// ============================================================================
// 1. จัดการพนักงานและสิทธิ์การเข้าถึง (Staff Management - ยกเว้น Manager)
// ============================================================================

/**
 * ดึงรายชื่อพนักงานทั้งหมด (ยกเว้น Manager)
 * GET /api/admin/staff
 */
exports.listStaff = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT u.user_id, u.branch_id, u.name, u.email, u.role,
              CASE WHEN u.role = 'admin' THEN 'ทุกสาขา (สำนักงานใหญ่ HQ)' ELSE b.name END AS branch_name
       FROM \`user\` u
       LEFT JOIN branch b ON u.branch_id = b.branch_id
       WHERE u.role != 'manager'
       ORDER BY u.role ASC, u.user_id ASC`
    );
    res.json({ success: true, staff: rows });
  } catch (err) {
    console.error("List Staff Error:", err);
    res.status(500).json({ success: false, error: "เกิดข้อผิดพลาดในการดึงข้อมูลพนักงาน" });
  }
};

/**
 * เพิ่มพนักงานใหม่ (กำหนดสาขาและสิทธิ์ Cashier)
 * POST /api/admin/staff
 */
exports.createStaff = async (req, res) => {
  const { name, email, password, branchId, role } = req.body || {};

  if (!name || !email || !password || !branchId) {
    return res.status(400).json({ success: false, error: "กรุณากรอกข้อมูลพนักงานให้ครบถ้วน" });
  }
  if (typeof name !== "string" || typeof email !== "string" || typeof password !== "string") {
    return res.status(400).json({ success: false, error: "ชนิดข้อมูลของ name, email, password ไม่ถูกต้อง" });
  }
  if (!EMAIL_RE.test(email.trim())) {
    return res.status(400).json({ success: false, error: "รูปแบบอีเมลไม่ถูกต้อง" });
  }
  if (password.trim().length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ success: false, error: `รหัสผ่านต้องยาวอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร` });
  }
  if (!isPositiveInt(Number(branchId))) {
    return res.status(400).json({ success: false, error: "branchId ไม่ถูกต้อง" });
  }

  // ป้องกันไม่ให้สร้างบทบาท admin หรือ manager ผ่านฟอร์มพนักงานหน้าร้าน
  if (role === "admin" || role === "manager") {
    return res.status(403).json({ success: false, error: "ไม่สามารถสร้างบทบาท Admin หรือ Manager ผ่านฟอร์มพนักงานได้" });
  }
  const assignedRole = role === "barista" ? "barista" : "cashier";

  try {
    const cleanEmail = email.trim().toLowerCase();
    if (!(await branchExists(Number(branchId)))) {
      return res.status(400).json({ success: false, error: "ไม่พบสาขาที่ระบุ" });
    }
    const [existing] = await db.query("SELECT user_id FROM `user` WHERE email = ?", [cleanEmail]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, error: "อีเมลนี้มีอยู่ในระบบแล้ว กรุณาใช้อีเมลอื่น" });
    }

    const [result] = await db.query(
      "INSERT INTO `user` (branch_id, name, email, password, role) VALUES (?, ?, ?, ?, ?)",
      [Number(branchId), name.trim(), cleanEmail, hashPassword(password.trim()), assignedRole]
    );

    res.status(201).json({
      success: true,
      message: `เพิ่มพนักงาน "${name}" สำเร็จ`,
      userId: result.insertId,
    });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ success: false, error: "อีเมลนี้มีอยู่ในระบบแล้ว กรุณาใช้อีเมลอื่น" });
    }
    console.error("Create Staff Error:", err);
    res.status(500).json({ success: false, error: "เกิดข้อผิดพลาดในการสร้างบัญชีพนักงาน" });
  }
};

/**
 * แก้ไขข้อมูลพนักงาน
 * PUT /api/admin/staff/:id
 */
exports.updateStaff = async (req, res) => {
  const staffId = Number(req.params.id);
  const { name, email, password, branchId, role } = req.body || {};
  if (!isPositiveInt(staffId)) {
    return res.status(400).json({ success: false, error: "รหัสพนักงานไม่ถูกต้อง" });
  }

  try {
    const [target] = await db.query("SELECT user_id, branch_id, role, name, email FROM `user` WHERE user_id = ?", [staffId]);
    if (target.length === 0) {
      return res.status(404).json({ success: false, error: "ไม่พบข้อมูลพนักงาน" });
    }

    if (target[0].role === "manager") {
      return res.status(403).json({ success: false, error: "ไม่สามารถแก้ไขข้อมูลบัญชี Manager ได้ตามนโยบายระบบ" });
    }

    if (email !== undefined && (typeof email !== "string" || !EMAIL_RE.test(email.trim()))) {
      return res.status(400).json({ success: false, error: "รูปแบบอีเมลไม่ถูกต้อง" });
    }
    if (name !== undefined && (typeof name !== "string" || !name.trim())) {
      return res.status(400).json({ success: false, error: "ชื่อพนักงานต้องไม่ว่าง" });
    }
    if (password !== undefined && password !== "" && (typeof password !== "string" || password.trim().length < MIN_PASSWORD_LENGTH)) {
      return res.status(400).json({ success: false, error: `รหัสผ่านต้องยาวอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร` });
    }
    if (branchId !== undefined && !isPositiveInt(Number(branchId))) {
      return res.status(400).json({ success: false, error: "branchId ไม่ถูกต้อง" });
    }

    // ฟิลด์ที่ไม่ได้ส่งมาให้คงค่าเดิม (ไม่เขียนทับเป็นค่าว่าง/NULL/สาขา 1)
    const cleanEmail = email ? email.trim().toLowerCase() : target[0].email;
    if (cleanEmail !== target[0].email) {
      const [emailCheck] = await db.query(
        "SELECT user_id FROM `user` WHERE email = ? AND user_id != ?",
        [cleanEmail, staffId]
      );
      if (emailCheck.length > 0) {
        return res.status(400).json({ success: false, error: "อีเมลนี้ถูกใช้งานโดยผู้ใช้อื่นแล้ว" });
      }
    }

    if (role === "admin" && target[0].role !== "admin") {
      return res.status(403).json({ success: false, error: "ไม่สามารถเปลี่ยนสิทธิ์พนักงานเป็น Admin ได้" });
    }

    if (role === "manager") {
      return res.status(403).json({ success: false, error: "ไม่สามารถกำหนดบทบาท Manager ได้ตามนโยบายระบบ" });
    }

    // หากเป็นบัญชี admin ให้คง role เป็น admin เสมอ และไม่เปลี่ยนสาขา (เนื่องจาก admin ดูแลทุกสาขา)
    const isAdmin = target[0].role === "admin";
    const assignedRole = isAdmin
      ? "admin"
      : (role === undefined ? target[0].role : (role === "barista" ? "barista" : "cashier"));
    const finalName = name ? name.trim() : target[0].name;
    const finalBranch = isAdmin
      ? (target[0].branch_id || 1)
      : (branchId !== undefined ? Number(branchId) : target[0].branch_id);

    if (!isAdmin && finalBranch !== target[0].branch_id && !(await branchExists(finalBranch))) {
      return res.status(400).json({ success: false, error: "ไม่พบสาขาที่ระบุ" });
    }

    if (password && password.trim()) {
      await db.query(
        "UPDATE `user` SET name = ?, email = ?, password = ?, branch_id = ?, role = ? WHERE user_id = ?",
        [finalName, cleanEmail, hashPassword(password.trim()), finalBranch, assignedRole, staffId]
      );
    } else {
      await db.query(
        "UPDATE `user` SET name = ?, email = ?, branch_id = ?, role = ? WHERE user_id = ?",
        [finalName, cleanEmail, finalBranch, assignedRole, staffId]
      );
    }

    res.json({ success: true, message: isAdmin ? "อัปเดตข้อมูลผู้ดูแลระบบสำเร็จ" : "อัปเดตข้อมูลพนักงานสำเร็จ" });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ success: false, error: "อีเมลนี้ถูกใช้งานโดยผู้ใช้อื่นแล้ว" });
    }
    console.error("Update Staff Error:", err);
    res.status(500).json({ success: false, error: "เกิดข้อผิดพลาดในการอัปเดตพนักงาน" });
  }
};

/**
 * ลบพนักงานออกจากระบบ
 * DELETE /api/admin/staff/:id
 */
exports.deleteStaff = async (req, res) => {
  const staffId = Number(req.params.id);
  if (!isPositiveInt(staffId)) {
    return res.status(400).json({ success: false, error: "รหัสพนักงานไม่ถูกต้อง" });
  }

  if (staffId === req.user?.userId) {
    return res.status(400).json({ success: false, error: "ไม่สามารถลบบัญชีของตัวเองได้" });
  }

  try {
    const [target] = await db.query("SELECT user_id, name, role FROM `user` WHERE user_id = ?", [staffId]);
    if (target.length === 0) {
      return res.status(404).json({ success: false, error: "ไม่พบข้อมูลพนักงาน" });
    }

    if (target[0].role === "admin") {
      return res.status(403).json({ success: false, error: "ไม่สามารถลบบัญชีผู้ดูแลระบบ (Admin) ได้" });
    }

    if (target[0].role === "manager") {
      return res.status(403).json({ success: false, error: "ไม่สามารถลบบัญชี Manager ได้ตามนโยบายระบบ" });
    }

    // โอนออเดอร์ของพนักงานคนนี้ให้ admin แล้วลบบัญชี ทำใน transaction เดียวกัน
    // หากขั้นใดล้มเหลวจะย้อนกลับทั้งหมด ไม่เหลือสถานะค้างครึ่งทาง
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query("UPDATE orders SET user_id = ? WHERE user_id = ?", [req.user.userId, staffId]);
      await conn.query("DELETE FROM `user` WHERE user_id = ?", [staffId]);
      await conn.commit();
    } catch (txErr) {
      await conn.rollback();
      throw txErr;
    } finally {
      conn.release();
    }

    res.json({ success: true, message: `ลบบัญชีพนักงาน "${target[0].name}" เรียบร้อยแล้ว` });
  } catch (err) {
    console.error("Delete Staff Error:", err);
    res.status(500).json({ success: false, error: "เกิดข้อผิดพลาดในการลบพนักงาน" });
  }
};

// ============================================================================
// 2. จัดการระบบสมาชิกและโปรโมชั่น (Member & Promotion Management)
// ============================================================================

/**
 * ดึงรายชื่อสมาชิกทั้งหมด พร้อมรองรับการค้นหา
 * GET /api/admin/members
 */
exports.listMembers = async (req, res) => {
  const query = (req.query.q || "").trim();
  try {
    let sql = "SELECT member_id, name, phone, points, discount_rate, joined_at FROM `member`";
    let params = [];

    if (query) {
      sql += " WHERE name LIKE ? OR phone LIKE ?";
      params.push(`%${query}%`, `%${query}%`);
    }

    sql += " ORDER BY member_id DESC";
    const [rows] = await db.query(sql, params);
    res.json({ success: true, members: rows });
  } catch (err) {
    console.error("List Members Error:", err);
    res.status(500).json({ success: false, error: "เกิดข้อผิดพลาดในการดึงข้อมูลสมาชิก" });
  }
};

/**
 * เพิ่มสมาชิกใหม่
 * POST /api/admin/members
 */
exports.createMember = async (req, res) => {
  const { name, phone, points, discountRate } = req.body || {};

  if (!name || !phone) {
    return res.status(400).json({ success: false, error: "กรุณาระบุชื่อและเบอร์โทรศัพท์" });
  }

  if (typeof name !== "string" || typeof phone !== "string") {
    return res.status(400).json({ success: false, error: "ชนิดข้อมูลของชื่อและเบอร์โทรไม่ถูกต้อง" });
  }
  const cleanPhone = phone.trim();
  if (!/^\d{10}$/.test(cleanPhone)) {
    return res.status(400).json({ success: false, error: "เบอร์โทรศัพท์ต้องเป็นตัวเลข 10 หลัก" });
  }
  const newPoints = points === undefined ? 0 : Number(points);
  const newRate = discountRate === undefined ? 0.05 : Number(discountRate);
  const numbersError = validateMemberNumbers(newPoints, newRate);
  if (numbersError) {
    return res.status(400).json({ success: false, error: numbersError });
  }

  try {
    const [exist] = await db.query("SELECT member_id FROM `member` WHERE phone = ?", [cleanPhone]);
    if (exist.length > 0) {
      return res.status(400).json({ success: false, error: "หมายเลขโทรศัพท์นี้เป็นสมาชิกอยู่แล้ว" });
    }

    const [result] = await db.query(
      "INSERT INTO `member` (name, phone, points, discount_rate) VALUES (?, ?, ?, ?)",
      [name.trim(), cleanPhone, newPoints, newRate]
    );

    res.status(201).json({
      success: true,
      message: `เพิ่มสมาชิก "${name}" สำเร็จ`,
      memberId: result.insertId,
    });
  } catch (err) {
    console.error("Create Member Error:", err);
    res.status(500).json({ success: false, error: "เกิดข้อผิดพลาดในการบันทึกสมาชิก" });
  }
};

/**
 * แก้ไขข้อมูลสมาชิก / ปรับแต้ม / กำหนดส่วนลด
 * PUT /api/admin/members/:id
 */
exports.updateMember = async (req, res) => {
  const memberId = Number(req.params.id);
  const { name, phone, points, discountRate } = req.body || {};

  if (!isPositiveInt(memberId)) {
    return res.status(400).json({ success: false, error: "รหัสสมาชิกไม่ถูกต้อง" });
  }
  if (!name || !phone) {
    return res.status(400).json({ success: false, error: "กรุณาระบุชื่อและเบอร์โทรศัพท์" });
  }
  if (typeof name !== "string" || typeof phone !== "string") {
    return res.status(400).json({ success: false, error: "ชนิดข้อมูลของชื่อและเบอร์โทรไม่ถูกต้อง" });
  }

  const cleanPhone = phone.trim();
  if (!/^\d{10}$/.test(cleanPhone)) {
    return res.status(400).json({ success: false, error: "เบอร์โทรศัพท์ต้องเป็นตัวเลข 10 หลัก" });
  }
  const newPoints = points === undefined ? 0 : Number(points);
  const newRate = discountRate === undefined ? 0.05 : Number(discountRate);
  const numbersError = validateMemberNumbers(newPoints, newRate);
  if (numbersError) {
    return res.status(400).json({ success: false, error: numbersError });
  }

  try {
    const [found] = await db.query("SELECT member_id FROM `member` WHERE member_id = ?", [memberId]);
    if (found.length === 0) {
      return res.status(404).json({ success: false, error: "ไม่พบข้อมูลสมาชิก" });
    }

    const [exist] = await db.query(
      "SELECT member_id FROM `member` WHERE phone = ? AND member_id != ?",
      [cleanPhone, memberId]
    );
    if (exist.length > 0) {
      return res.status(400).json({ success: false, error: "หมายเลขโทรศัพท์นี้ถูกใช้โดยสมาชิกท่านอื่นแล้ว" });
    }

    await db.query(
      "UPDATE `member` SET name = ?, phone = ?, points = ?, discount_rate = ? WHERE member_id = ?",
      [name.trim(), cleanPhone, newPoints, newRate, memberId]
    );

    res.json({ success: true, message: "อัปเดตข้อมูลสมาชิกและโปรโมชั่นสำเร็จ" });
  } catch (err) {
    console.error("Update Member Error:", err);
    res.status(500).json({ success: false, error: "เกิดข้อผิดพลาดในการอัปเดตสมาชิก" });
  }
};

/**
 * ลบสมาชิก
 * DELETE /api/admin/members/:id
 */
exports.deleteMember = async (req, res) => {
  const memberId = Number(req.params.id);
  if (!isPositiveInt(memberId)) {
    return res.status(400).json({ success: false, error: "รหัสสมาชิกไม่ถูกต้อง" });
  }
  try {
    const [found] = await db.query("SELECT member_id FROM `member` WHERE member_id = ?", [memberId]);
    if (found.length === 0) {
      return res.status(404).json({ success: false, error: "ไม่พบข้อมูลสมาชิก" });
    }

    // ถอดสมาชิกออกจากออเดอร์เดิมแล้วลบสมาชิก ทำใน transaction เดียวกัน
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query("UPDATE orders SET member_id = NULL WHERE member_id = ?", [memberId]);
      await conn.query("DELETE FROM `member` WHERE member_id = ?", [memberId]);
      await conn.commit();
    } catch (txErr) {
      await conn.rollback();
      throw txErr;
    } finally {
      conn.release();
    }
    res.json({ success: true, message: "ลบข้อมูลสมาชิกเรียบร้อยแล้ว" });
  } catch (err) {
    console.error("Delete Member Error:", err);
    res.status(500).json({ success: false, error: "เกิดข้อผิดพลาดในการลบสมาชิก" });
  }
};

// ============================================================================
// 3. จัดการสาขาและข้อมูลร้าน (Branch Management)
// ============================================================================

/**
 * ดึงรายชื่อสาขา พร้อมจำนวนพนักงานและจำนวนเมนู
 * GET /api/admin/branches
 */
exports.listBranches = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT b.branch_id, b.name, b.address,
              COUNT(DISTINCT u.user_id) AS staff_count,
              COUNT(DISTINCT m.menu_id) AS menu_count
       FROM branch b
       LEFT JOIN \`user\` u ON b.branch_id = u.branch_id
       LEFT JOIN menu_item m ON b.branch_id = m.branch_id
       GROUP BY b.branch_id, b.name, b.address
       ORDER BY b.branch_id ASC`
    );
    res.json({ success: true, branches: rows });
  } catch (err) {
    console.error("List Branches Error:", err);
    res.status(500).json({ success: false, error: "เกิดข้อผิดพลาดในการดึงข้อมูลสาขา" });
  }
};

/**
 * เพิ่มสาขาใหม่
 * POST /api/admin/branches
 */
exports.createBranch = async (req, res) => {
  const { name, address } = req.body || {};

  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, error: "กรุณาระบุชื่อสาขา" });
  }

  try {
    const [result] = await db.query(
      "INSERT INTO branch (name, address) VALUES (?, ?)",
      [name.trim(), (address || "").trim()]
    );
    res.status(201).json({
      success: true,
      message: `เพิ่มสาขา "${name.trim()}" สำเร็จ`,
      branchId: result.insertId,
    });
  } catch (err) {
    console.error("Create Branch Error:", err);
    res.status(500).json({ success: false, error: "เกิดข้อผิดพลาดในการเพิ่มสาขา" });
  }
};

/**
 * แก้ไขข้อมูลสาขา
 * PUT /api/admin/branches/:id
 */
exports.updateBranch = async (req, res) => {
  const branchId = Number(req.params.id);
  const { name, address } = req.body || {};

  if (!isPositiveInt(branchId)) {
    return res.status(400).json({ success: false, error: "รหัสสาขาไม่ถูกต้อง" });
  }
  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ success: false, error: "กรุณาระบุชื่อสาขา" });
  }

  try {
    if (!(await branchExists(branchId))) {
      return res.status(404).json({ success: false, error: "ไม่พบข้อมูลสาขา" });
    }
    await db.query(
      "UPDATE branch SET name = ?, address = ? WHERE branch_id = ?",
      [name.trim(), (address || "").trim(), branchId]
    );
    res.json({ success: true, message: "อัปเดตข้อมูลสาขาเรียบร้อยแล้ว" });
  } catch (err) {
    console.error("Update Branch Error:", err);
    res.status(500).json({ success: false, error: "เกิดข้อผิดพลาดในการอัปเดตสาขา" });
  }
};
