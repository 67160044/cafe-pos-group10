// src/controllers/adminController.js
const db = require("../config/db");

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

  // ป้องกันไม่ให้สร้างบทบาท admin หรือ manager ผ่านฟอร์มพนักงานหน้าร้าน
  if (role === "admin" || role === "manager") {
    return res.status(403).json({ success: false, error: "ไม่สามารถสร้างบทบาท Admin หรือ Manager ผ่านฟอร์มพนักงานได้" });
  }
  const assignedRole = role === "barista" ? "barista" : "cashier";

  try {
    const cleanEmail = email.trim().toLowerCase();
    const [existing] = await db.query("SELECT user_id FROM `user` WHERE email = ?", [cleanEmail]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, error: "อีเมลนี้มีอยู่ในระบบแล้ว กรุณาใช้อีเมลอื่น" });
    }

    const [result] = await db.query(
      "INSERT INTO `user` (branch_id, name, email, password, role) VALUES (?, ?, ?, ?, ?)",
      [Number(branchId), name.trim(), cleanEmail, password.trim(), assignedRole]
    );

    res.status(201).json({
      success: true,
      message: `เพิ่มพนักงาน "${name}" สำเร็จ`,
      userId: result.insertId,
    });
  } catch (err) {
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

  try {
    const [target] = await db.query("SELECT user_id, branch_id, role FROM `user` WHERE user_id = ?", [staffId]);
    if (target.length === 0) {
      return res.status(404).json({ success: false, error: "ไม่พบข้อมูลพนักงาน" });
    }

    if (target[0].role === "manager") {
      return res.status(403).json({ success: false, error: "ไม่สามารถแก้ไขข้อมูลบัญชี Manager ได้ตามนโยบายระบบ" });
    }

    const cleanEmail = email ? email.trim().toLowerCase() : null;
    if (cleanEmail) {
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
      : (role === "barista" ? "barista" : "cashier");
    const finalName = name ? name.trim() : "";
    const finalBranch = isAdmin
      ? (target[0].branch_id || 1)
      : (branchId ? Number(branchId) : 1);

    if (password && password.trim()) {
      await db.query(
        "UPDATE `user` SET name = ?, email = ?, password = ?, branch_id = ?, role = ? WHERE user_id = ?",
        [finalName, cleanEmail, password.trim(), finalBranch, assignedRole, staffId]
      );
    } else {
      await db.query(
        "UPDATE `user` SET name = ?, email = ?, branch_id = ?, role = ? WHERE user_id = ?",
        [finalName, cleanEmail, finalBranch, assignedRole, staffId]
      );
    }

    res.json({ success: true, message: isAdmin ? "อัปเดตข้อมูลผู้ดูแลระบบสำเร็จ" : "อัปเดตข้อมูลพนักงานสำเร็จ" });
  } catch (err) {
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

    // Reassign orders handled by this staff to admin before deletion to maintain integrity
    await db.query("UPDATE orders SET user_id = ? WHERE user_id = ?", [req.user.userId, staffId]);
    await db.query("DELETE FROM `user` WHERE user_id = ?", [staffId]);

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

  const cleanPhone = phone.trim();
  if (!/^\d{10}$/.test(cleanPhone)) {
    return res.status(400).json({ success: false, error: "เบอร์โทรศัพท์ต้องเป็นตัวเลข 10 หลัก" });
  }

  try {
    const [exist] = await db.query("SELECT member_id FROM `member` WHERE phone = ?", [cleanPhone]);
    if (exist.length > 0) {
      return res.status(400).json({ success: false, error: "หมายเลขโทรศัพท์นี้เป็นสมาชิกอยู่แล้ว" });
    }

    const [result] = await db.query(
      "INSERT INTO `member` (name, phone, points, discount_rate) VALUES (?, ?, ?, ?)",
      [name.trim(), cleanPhone, Number(points) || 0, Number(discountRate) || 0.05]
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

  if (!name || !phone) {
    return res.status(400).json({ success: false, error: "กรุณาระบุชื่อและเบอร์โทรศัพท์" });
  }

  const cleanPhone = phone.trim();
  if (!/^\d{10}$/.test(cleanPhone)) {
    return res.status(400).json({ success: false, error: "เบอร์โทรศัพท์ต้องเป็นตัวเลข 10 หลัก" });
  }

  try {
    const [exist] = await db.query(
      "SELECT member_id FROM `member` WHERE phone = ? AND member_id != ?",
      [cleanPhone, memberId]
    );
    if (exist.length > 0) {
      return res.status(400).json({ success: false, error: "หมายเลขโทรศัพท์นี้ถูกใช้โดยสมาชิกท่านอื่นแล้ว" });
    }

    await db.query(
      "UPDATE `member` SET name = ?, phone = ?, points = ?, discount_rate = ? WHERE member_id = ?",
      [name.trim(), cleanPhone, Number(points) || 0, Number(discountRate) || 0.05, memberId]
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
  try {
    await db.query("UPDATE orders SET member_id = NULL WHERE member_id = ?", [memberId]);
    await db.query("DELETE FROM `member` WHERE member_id = ?", [memberId]);
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

  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, error: "กรุณาระบุชื่อสาขา" });
  }

  try {
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
