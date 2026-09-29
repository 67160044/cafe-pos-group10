// src/models/orderModel.js
const db = require("../config/db");

exports.create = async (branchId, employeeId, paymentMethod) => {
  const [result] = await db.query(
    "INSERT INTO orders (branch_id, employee_id, payment_method, created_at) VALUES (?, ?, ?, NOW())",
    [branchId, employeeId, paymentMethod],
  );
  return result.insertId;
};

exports.addItem = async (orderId, menuId, quantity, unitPrice) => {
  await db.query(
    "INSERT INTO order_item (order_id, menu_id, quantity, unit_price) VALUES (?, ?, ?, ?)",
    [orderId, menuId, quantity, unitPrice], // ราคาดึงจาก DB เสมอ ไม่รับจาก client
  );
};
