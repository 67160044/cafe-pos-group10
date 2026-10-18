const db = require("../config/db");

exports.create = async (branchId, userId, paymentMethod, memberId = null, status = "pending", conn = db) => {
  const [result] = await conn.query(
    "INSERT INTO orders (branch_id, user_id, member_id, payment_method, status, created_at) VALUES (?, ?, ?, ?, ?, NOW())",
    [branchId, userId, memberId || null, paymentMethod, status]
  );
  return result.insertId;
};

const FIND_ALL_LIMIT = 500;

exports.findAll = async () => {
  const [rows] = await db.query(`
    SELECT o.*, u.name AS user_name, b.name AS branch_name, m.name AS member_name, m.phone AS member_phone
    FROM orders o
    LEFT JOIN \`user\` u ON o.user_id = u.user_id
    LEFT JOIN branch b ON o.branch_id = b.branch_id
    LEFT JOIN \`member\` m ON o.member_id = m.member_id
    ORDER BY o.order_id DESC
    LIMIT ${FIND_ALL_LIMIT}
  `);
  return rows;
};

exports.addItem = async (orderId, menuId, quantity, unitPrice, notes = null, conn = db) => {
  await conn.query(
    "INSERT INTO order_item (order_id, menu_id, quantity, unit_price, notes) VALUES (?, ?, ?, ?, ?)",
    [orderId, menuId, quantity, unitPrice, notes || null]
  );
};

/**
 * ดึงรายการคิวออเดอร์สำหรับบาริสต้า (Barista Queue / KDS)
 * แยกตาม branchId และเรียงลำดับสถานะ
 */
exports.getBaristaQueue = async (branchId = null) => {
  let sql = `
    SELECT o.order_id, o.branch_id, o.user_id, o.member_id, o.payment_method, o.status, o.created_at,
           u.name AS cashier_name, b.name AS branch_name, m.name AS member_name
    FROM orders o
    LEFT JOIN \`user\` u ON o.user_id = u.user_id
    LEFT JOIN branch b ON o.branch_id = b.branch_id
    LEFT JOIN \`member\` m ON o.member_id = m.member_id
  `;
  const params = [];
  if (branchId && branchId !== "all") {
    sql += " WHERE o.branch_id = ?";
    params.push(Number(branchId));
  }
  sql += `
    ORDER BY 
      CASE o.status 
        WHEN 'preparing' THEN 1 
        WHEN 'pending' THEN 2 
        WHEN 'ready' THEN 3 
        WHEN 'completed' THEN 4 
        ELSE 5 
      END, 
      o.order_id DESC
    LIMIT 100
  `;

  const [orders] = await db.query(sql, params);
  if (orders.length === 0) return [];

  const orderIds = orders.map((o) => o.order_id);
  const [items] = await db.query(
    `SELECT oi.order_item_id, oi.order_id, oi.menu_id, oi.quantity, oi.unit_price, oi.notes,
            m.name AS menu_name, c.name AS category_name
     FROM order_item oi
     LEFT JOIN menu_item m ON oi.menu_id = m.menu_id
     LEFT JOIN category c ON m.category_id = c.category_id
     WHERE oi.order_id IN (?)
     ORDER BY oi.order_item_id ASC`,
    [orderIds]
  );

  const itemsByOrderId = new Map();
  for (const it of items) {
    if (!itemsByOrderId.has(it.order_id)) itemsByOrderId.set(it.order_id, []);
    itemsByOrderId.get(it.order_id).push(it);
  }

  return orders.map((o) => ({
    ...o,
    items: itemsByOrderId.get(o.order_id) || [],
  }));
};

/**
 * อัปเดตสถานะออเดอร์โดยบาริสต้า (pending -> preparing -> ready -> completed)
 */
exports.updateStatus = async (orderId, status) => {
  const [result] = await db.query(
    "UPDATE orders SET status = ? WHERE order_id = ?",
    [status, Number(orderId)]
  );
  return result.affectedRows > 0;
};

/**
 * ดึงสถานะและสาขาของออเดอร์ ใช้ตรวจสิทธิ์สาขาและลำดับสถานะก่อนอัปเดต
 */
exports.findStatusAndBranch = async (orderId) => {
  const [rows] = await db.query(
    "SELECT order_id, branch_id, status FROM orders WHERE order_id = ?",
    [Number(orderId)]
  );
  return rows[0] || null;
};