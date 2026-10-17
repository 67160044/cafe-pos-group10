// src/models/memberModel.js
const db = require("../config/db");

/**
 * ค้นหาข้อมูลสมาชิก Cafe Club จากเบอร์โทรศัพท์ 10 หลัก
 * @param {string} phone
 * @returns {Promise<object|null>}
 */
exports.findByPhone = async (phone) => {
  const [rows] = await db.query(
    "SELECT member_id, name, phone, points, discount_rate, joined_at FROM `member` WHERE phone = ?",
    [phone.trim()]
  );
  return rows[0] || null;
};

/**
 * ค้นหาข้อมูลสมาชิกจาก member_id
 * @param {number} memberId
 * @returns {Promise<object|null>}
 */
exports.findById = async (memberId) => {
  const [rows] = await db.query(
    "SELECT member_id, name, phone, points, discount_rate, joined_at FROM `member` WHERE member_id = ?",
    [memberId]
  );
  return rows[0] || null;
};

/**
 * ดึงรายการสมาชิกทั้งหมด
 * @returns {Promise<Array>}
 */
exports.findAll = async () => {
  const [rows] = await db.query(
    "SELECT member_id, name, phone, points, discount_rate, joined_at FROM `member` ORDER BY member_id ASC"
  );
  return rows;
};

/**
 * เพิ่มแต้มสะสมให้สมาชิก
 * @param {number} memberId
 * @param {number} pointsToAdd
 */
exports.addPoints = async (memberId, pointsToAdd) => {
  if (!pointsToAdd || pointsToAdd <= 0) return;
  await db.query(
    "UPDATE `member` SET points = points + ? WHERE member_id = ?",
    [pointsToAdd, memberId]
  );
};

/**
 * สมัครสมาชิกใหม่ Cafe Club
 * @param {object} param0
 * @returns {Promise<object>}
 */
exports.create = async ({ name, phone, discountRate = 0.05 }) => {
  const [result] = await db.query(
    "INSERT INTO `member` (name, phone, points, discount_rate) VALUES (?, ?, 0, ?)",
    [name.trim(), phone.trim(), discountRate]
  );
  return {
    memberId: result.insertId,
    name: name.trim(),
    phone: phone.trim(),
    points: 0,
    discountRate,
  };
};

