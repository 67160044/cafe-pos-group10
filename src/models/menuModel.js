// src/models/menuModel.js (ส่วนที่ใช้ตรวจ/ตัดสต็อกตอนสั่งซื้อ)
const db = require("../config/db");

exports.findManyForStockCheck = async (menuIds, branchId) => {
  const [rows] = await db.query(
    "SELECT menu_id, price, stock_quantity FROM menu_item WHERE menu_id IN (?) AND branch_id = ?",
    [menuIds, branchId],
  );
  return rows;
};

exports.deductStock = async (menuId, quantity) => {
  await db.query(
    "UPDATE menu_item SET stock_quantity = stock_quantity - ? WHERE menu_id = ?",
    [quantity, menuId],
  );
};
exports.findAllByBranch = async (branchId) => {
  const [rows] = await db.query(
    `SELECT m.*, c.name AS category_name 
     FROM menu_item m 
     LEFT JOIN category c ON m.category_id = c.category_id 
     WHERE m.branch_id = ?`,
    [branchId],
  );
  return rows;
};

exports.findByIdAndBranch = async (menuId, branchId) => {
  const [rows] = await db.query(
    `SELECT m.*, c.name AS category_name 
     FROM menu_item m 
     LEFT JOIN category c ON m.category_id = c.category_id 
     WHERE m.menu_id = ? AND m.branch_id = ?`,
    [menuId, branchId],
  );
  return rows[0];
};

exports.create = async (branchId, categoryId, name, price, stockQuantity) => {
  const [result] = await db.query(
    "INSERT INTO menu_item (branch_id, category_id, name, price, stock_quantity) VALUES (?, ?, ?, ?, ?)",
    [branchId, categoryId, name, price, stockQuantity ?? 0],
  );
  return result.insertId;
};

exports.updateFields = async (menuId, branchId, { categoryId, name, price, stockQuantity }) => {
  // branch_id กรองคู่กับ menu_id เสมอ ป้องกัน IDOR ตามที่อธิบายไว้ข้างต้น
  const [result] = await db.query(
    `UPDATE menu_item
     SET category_id = COALESCE(?, category_id),
         name = COALESCE(?, name),
         price = COALESCE(?, price),
         stock_quantity = COALESCE(?, stock_quantity)
     WHERE menu_id = ? AND branch_id = ?`,
    [categoryId ?? null, name ?? null, price ?? null, stockQuantity ?? null, menuId, branchId],
  );
  return result.affectedRows;
};

exports.remove = async (menuId, branchId) => {
  const [result] = await db.query(
    "DELETE FROM menu_item WHERE menu_id = ? AND branch_id = ?",
    [menuId, branchId],
  );
  return result.affectedRows;
};