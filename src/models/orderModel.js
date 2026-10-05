const db = require("../config/db");

exports.create = async (branchId, employeeId, paymentMethod) => {
  const [result] = await db.query(
    "INSERT INTO orders (branch_id, employee_id, payment_method, created_at) VALUES (?, ?, ?, NOW())",
    [branchId, employeeId, paymentMethod]
  );
  return result.insertId;
};

exports.findAll = async () => {
  const [rows] = await db.query("SELECT * FROM orders");
  return rows;
};

exports.addItem = async (orderId, menuId, quantity, unitPrice) => {
  await db.query(
    "INSERT INTO order_item (order_id, menu_id, quantity, unit_price) VALUES (?, ?, ?, ?)",
    [orderId, menuId, quantity, unitPrice]
  );
};