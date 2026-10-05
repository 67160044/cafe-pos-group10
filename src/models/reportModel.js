// src/models/reportModel.js
const db = require("../config/db");

exports.getSalesReport = async ({ from, to, branchId, topFilter }) => {
  // 1. ยอดขายรวม และ จำนวนออเดอร์ทั้งหมด
  let summaryQuery = `
    SELECT 
      COALESCE(COUNT(DISTINCT o.order_id), 0) AS order_count,
      COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS total_sales
    FROM orders o
    LEFT JOIN order_item oi ON o.order_id = oi.order_id
    WHERE DATE(o.created_at) >= ? AND DATE(o.created_at) <= ?
  `;
  const summaryParams = [from, to];
  if (branchId) {
    summaryQuery += ` AND o.branch_id = ?`;
    summaryParams.push(branchId);
  }
  const [summaryRows] = await db.query(summaryQuery, summaryParams);

  // 2. รายได้และจำนวนออเดอร์ แยกตามสาขา
  let branchQuery = `
    SELECT 
      b.branch_id,
      b.name AS branch_name,
      COALESCE(COUNT(DISTINCT o.order_id), 0) AS orders,
      COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS sales
    FROM branch b
    LEFT JOIN orders o ON b.branch_id = o.branch_id AND DATE(o.created_at) >= ? AND DATE(o.created_at) <= ?
    LEFT JOIN order_item oi ON o.order_id = oi.order_id
  `;
  const branchParams = [from, to];
  if (branchId) {
    branchQuery += ` WHERE b.branch_id = ?`;
    branchParams.push(branchId);
  }
  branchQuery += ` GROUP BY b.branch_id, b.name ORDER BY b.branch_id ASC`;
  const [branchRows] = await db.query(branchQuery, branchParams);

  // 3. เมนูขายดี (Top selling menus)
  let topFrom = from;
  let topTo = to;
  if (topFilter === "day") {
    topFrom = to;
  } else if (topFilter === "week") {
    const d = new Date(to);
    d.setDate(d.getDate() - 6);
    topFrom = d.toISOString().split("T")[0];
  }

  let topQuery = `
    SELECT 
      m.name,
      COALESCE(SUM(oi.quantity), 0) AS quantity,
      COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS sales
    FROM order_item oi
    JOIN orders o ON oi.order_id = o.order_id
    JOIN menu_item m ON oi.menu_id = m.menu_id
    WHERE DATE(o.created_at) >= ? AND DATE(o.created_at) <= ?
  `;
  const topParams = [topFrom, topTo];
  if (branchId) {
    topQuery += ` AND o.branch_id = ?`;
    topParams.push(branchId);
  }
  topQuery += ` GROUP BY m.menu_id, m.name ORDER BY quantity DESC, sales DESC LIMIT 10`;
  const [topRows] = await db.query(topQuery, topParams);

  return {
    summary: {
      total_sales: Number(summaryRows[0]?.total_sales || 0),
      order_count: Number(summaryRows[0]?.order_count || 0),
    },
    by_branch: branchRows.map((r) => ({
      branch_id: r.branch_id,
      branch_name: r.branch_name,
      orders: Number(r.orders || 0),
      sales: Number(r.sales || 0),
    })),
    top_menus: topRows.map((r) => ({
      name: r.name,
      quantity: Number(r.quantity || 0),
      sales: Number(r.sales || 0),
    })),
  };
};
