// src/controllers/orderController.js (ปรับปรุงจาก Sprint 1 ตาม schema wk07.md ให้เรียกผ่าน Model)
const db = require("../config/db");
const menuModel = require("../models/menuModel");
const orderModel = require("../models/orderModel");
const memberModel = require("../models/memberModel");

const ALLOWED_PAYMENT_METHODS = ["cash", "promptpay"];
const MAX_QUANTITY_PER_ITEM = 999;

// ข้อผิดพลาดที่เกิดจากข้อมูลของผู้ใช้ (ตอบกลับด้วย status ที่กำหนด ไม่ใช่ 500)
class RequestError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

exports.createOrder = async (req, res) => {
  const { items, paymentMethod, branchId, memberId } = req.body || {};

  // ผู้สร้างออเดอร์ต้องมาจาก token เท่านั้น ไม่เชื่อ userId/employeeId ที่ client ส่งมา
  const currentUserId = req.user?.userId || req.user?.employeeId;

  if (!Array.isArray(items) || items.length === 0) {
    return res
      .status(400)
      .json({ error: "ต้องมีรายการสินค้าอย่างน้อย 1 รายการ" });
  }

  // แคชเชียร์ถูกล็อกสาขาตามบัญชี ส่วน manager/admin ระบุสาขาเองได้
  let effectiveBranchId = Number(branchId);
  if (req.user && req.user.role === "cashier") {
    effectiveBranchId = Number(req.user.branchId);
  }

  if (!Number.isInteger(effectiveBranchId) || effectiveBranchId <= 0 || !currentUserId) {
    return res.status(400).json({ error: "ต้องระบุ branchId ที่ถูกต้อง" });
  }
  if (!ALLOWED_PAYMENT_METHODS.includes(paymentMethod)) {
    return res.status(400).json({
      error: `paymentMethod ต้องเป็นหนึ่งใน: ${ALLOWED_PAYMENT_METHODS.join(", ")}`,
    });
  }

  // ต้องเช็กชนิดข้อมูลตรงนี้ ไม่ใช่แค่เช็กว่ามีค่า เพราะ "2" + "3" ในภายหลัง
  // จะกลายเป็น string concatenation ("23") ไม่ใช่ผลรวมตัวเลข (5)
  const hasInvalidItem = items.some(
    (item) =>
      !item ||
      !Number.isInteger(item.menuId) ||
      item.menuId <= 0 ||
      !Number.isInteger(item.quantity) ||
      item.quantity <= 0 ||
      item.quantity > MAX_QUANTITY_PER_ITEM,
  );
  if (hasInvalidItem) {
    return res.status(400).json({
      error: `menuId และ quantity ของทุกรายการต้องเป็นจำนวนเต็มบวก (quantity ไม่เกิน ${MAX_QUANTITY_PER_ITEM})`,
    });
  }

  let effectiveMemberId = null;
  if (memberId !== undefined && memberId !== null && memberId !== "") {
    effectiveMemberId = Number(memberId);
    if (!Number.isInteger(effectiveMemberId) || effectiveMemberId <= 0) {
      return res.status(400).json({ error: "memberId ไม่ถูกต้อง" });
    }
  }

  // รวมจำนวนของรายการที่เป็นเมนูเดียวกัน ก่อนเช็กสต็อก
  // ป้องกันกรณีสั่งเมนูเดียวกันหลายบรรทัดแล้วแต่ละบรรทัดเช็กผ่านแยกกัน
  const quantityByMenuId = new Map();
  for (const item of items) {
    quantityByMenuId.set(
      item.menuId,
      (quantityByMenuId.get(item.menuId) || 0) + item.quantity,
    );
  }
  const menuIds = [...quantityByMenuId.keys()].sort((a, b) => a - b);

  let conn;
  try {
    if (effectiveMemberId) {
      const member = await memberModel.findById(effectiveMemberId);
      if (!member) {
        return res.status(400).json({ error: "ไม่พบสมาชิกตาม memberId ที่ระบุ" });
      }
    }

    // เช็กสต็อก สร้างออเดอร์ เพิ่มรายการ และตัดสต็อกอยู่ใน transaction เดียวกัน
    // หากขั้นใดล้มเหลวจะ rollback ทั้งหมด ไม่เหลือออเดอร์ที่ตัดสต็อกไม่ครบ
    conn = await db.getConnection();
    await conn.beginTransaction();

    // กรองด้วย branch_id เสมอ และล็อกแถว (FOR UPDATE) ไว้ถึงตอน commit
    // เพื่อไม่ให้สองคำขอที่สั่งเมนูเดียวกันพร้อมกันเช็กผ่านแล้วตัดสต็อกจนติดลบ
    const menuRows = await menuModel.findManyForStockCheck(
      menuIds,
      effectiveBranchId,
      conn,
      true,
    );
    const menuMap = new Map(menuRows.map((row) => [row.menu_id, row]));

    for (const menuId of menuIds) {
      const menu = menuMap.get(menuId);
      if (!menu) {
        throw new RequestError(400, `ไม่พบเมนู id ${menuId} ในสาขานี้`);
      }
      if (menu.stock_quantity < quantityByMenuId.get(menuId)) {
        throw new RequestError(400, `สต็อกไม่เพียงพอสำหรับเมนู id ${menuId}`);
      }
    }

    const orderId = await orderModel.create(
      effectiveBranchId,
      currentUserId,
      paymentMethod,
      effectiveMemberId,
      "pending",
      conn,
    );

    let orderSubtotal = 0;
    for (const item of items) {
      const menu = menuMap.get(item.menuId);
      const itemNotes = item.notes || item.desc || null;
      await orderModel.addItem(orderId, item.menuId, item.quantity, menu.price, itemNotes, conn);
      orderSubtotal += Number(menu.price) * item.quantity;
    }

    for (const menuId of menuIds) {
      const deducted = await menuModel.deductStock(menuId, quantityByMenuId.get(menuId), conn);
      if (!deducted) {
        throw new RequestError(400, `สต็อกไม่เพียงพอสำหรับเมนู id ${menuId}`);
      }
      await menuModel.recordStockMovement(menuId, -quantityByMenuId.get(menuId), conn);
    }

    await conn.commit();

    // หากเป็นสมาชิก Cafe Club ให้สะสมแต้ม (1 แต้ม ต่อทุกๆ 50 บาท หลังหักส่วนลด 5%)
    // ทำหลัง commit: ความล้มเหลวของการให้แต้มไม่ควรทำให้ออเดอร์ที่ขายแล้วหายไป
    if (effectiveMemberId) {
      try {
        const pointsEarned = Math.floor((orderSubtotal * 0.95) / 50);
        if (pointsEarned > 0) {
          await memberModel.addPoints(effectiveMemberId, pointsEarned);
        }
      } catch (e) {
        console.warn("Could not award member points:", e.message);
      }
    }

    const lowStockMenuIds = [];
    for (const menuId of menuIds) {
      const menu = menuMap.get(menuId);
      if (menu.stock_quantity - quantityByMenuId.get(menuId) < 10) {
        lowStockMenuIds.push(menuId);
      }
    }
    if (lowStockMenuIds.length > 0) {
      // ตัวอย่างขั้นต่ำ: บันทึกลง log ก่อน ส่วนการแจ้งเตือนจริง (อีเมล/LINE Notify)
      // เป็นหัวข้อขยายผลที่ไม่บังคับสำหรับ Sprint 2
      console.warn("สต็อกใกล้หมด menu_id:", lowStockMenuIds);
    }

    res.status(201).json({ orderId, status: "pending", lowStockMenuIds });
  } catch (err) {
    if (conn) {
      try {
        await conn.rollback();
      } catch (rollbackErr) {
        console.error("Rollback failed:", rollbackErr);
      }
    }
    if (err instanceof RequestError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการบันทึกออเดอร์" });
  } finally {
    if (conn) conn.release();
  }
};

exports.getAllOrders = async (req, res) => {
  try {
    const rows = await orderModel.findAll();
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลออเดอร์" });
  }
};

/**
 * ดึงรายการคิวเครื่องดื่มสำหรับหน้าจอบาริสต้า (Barista Queue KDS)
 * GET /api/orders/queue
 */
exports.getBaristaQueue = async (req, res) => {
  try {
    const user = req.user;
    let branchId = req.query.branchId;

    // สำหรับบาริสต้า และแคชเชียร์ ให้ล็อกสาขาตามบัญชีที่ล็อกอิน
    if (user && (user.role === "barista" || user.role === "cashier")) {
      branchId = user.branchId;
    }

    if (branchId !== undefined && branchId !== "all" && !/^\d+$/.test(String(branchId))) {
      return res.status(400).json({ success: false, error: "branchId ต้องเป็นตัวเลขหรือ all" });
    }

    const queue = await orderModel.getBaristaQueue(branchId);
    res.json({ success: true, queue });
  } catch (err) {
    console.error("Get Barista Queue Error:", err);
    res.status(500).json({ success: false, error: "เกิดข้อผิดพลาดในการดึงคิวออเดอร์ของบาริสต้า" });
  }
};

// ลำดับสถานะที่อนุญาต: pending -> preparing -> ready -> completed (ยกเลิกได้ก่อนปรุงเสร็จ)
const ALLOWED_TRANSITIONS = {
  pending: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["completed"],
  completed: [],
  cancelled: [],
};

/**
 * อัปเดตสถานะออเดอร์ (pending -> preparing -> ready -> completed)
 * PATCH /api/orders/:id/status
 */
exports.updateOrderStatus = async (req, res) => {
  const orderId = Number(req.params.id);
  const { status } = req.body || {};

  const allowedStatuses = Object.keys(ALLOWED_TRANSITIONS);
  if (!status || !allowedStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      error: `สถานะไม่ถูกต้อง รองรับเฉพาะ: ${allowedStatuses.join(", ")}`,
    });
  }
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return res.status(400).json({ success: false, error: "รหัสออเดอร์ไม่ถูกต้อง" });
  }

  try {
    const order = await orderModel.findStatusAndBranch(orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: "ไม่พบข้อมูลออเดอร์นี้ในระบบ" });
    }

    // บาริสต้าจัดการได้เฉพาะออเดอร์ของสาขาตัวเอง (manager/admin จัดการได้ทุกสาขา)
    if (req.user?.role === "barista" && Number(order.branch_id) !== Number(req.user.branchId)) {
      return res.status(403).json({
        success: false,
        error: "ไม่มีสิทธิ์จัดการออเดอร์ของสาขาอื่น",
      });
    }

    if (order.status !== status && !ALLOWED_TRANSITIONS[order.status].includes(status)) {
      return res.status(409).json({
        success: false,
        error: `ไม่สามารถเปลี่ยนสถานะจาก "${order.status}" เป็น "${status}" ได้`,
      });
    }

    if (order.status !== status) {
      await orderModel.updateStatus(orderId, status);
    }

    const statusLabels = {
      pending: "รอคิวชง",
      preparing: "กำลังปรุง",
      ready: "พร้อมเสิร์ฟ",
      completed: "เสร็จสิ้น",
      cancelled: "ยกเลิก",
    };

    res.json({
      success: true,
      orderId,
      status,
      statusLabel: statusLabels[status] || status,
      message: `อัปเดตสถานะออเดอร์ #${orderId} เป็น "${statusLabels[status] || status}" เรียบร้อย`,
    });
  } catch (err) {
    console.error("Update Order Status Error:", err);
    res.status(500).json({ success: false, error: "เกิดข้อผิดพลาดในการอัปเดตสถานะออเดอร์" });
  }
};
