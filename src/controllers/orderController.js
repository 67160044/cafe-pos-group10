// src/controllers/orderController.js (ปรับปรุงจาก Sprint 1 ตาม schema wk07.md ให้เรียกผ่าน Model)
const menuModel = require("../models/menuModel");
const orderModel = require("../models/orderModel");
const memberModel = require("../models/memberModel");

exports.createOrder = async (req, res) => {
  const { items, paymentMethod, employeeId, userId, branchId, memberId } = req.body;
  const currentUserId = userId || employeeId || req.user?.userId || req.user?.employeeId;

  if (!Array.isArray(items) || items.length === 0) {
    return res
      .status(400)
      .json({ error: "ต้องมีรายการสินค้าอย่างน้อย 1 รายการ" });
  }
  // สำหรับแคชเชียร์ ล็อกสาขาให้อยู่เฉพาะสาขาของตนเอง ไม่สามารถเปลี่ยนสาขาได้
  let effectiveBranchId = Number(branchId);
  if (req.user && req.user.role === "cashier") {
    effectiveBranchId = Number(req.user.branchId || effectiveBranchId);
  }

  if (!effectiveBranchId || !currentUserId || !paymentMethod) {
    return res
      .status(400)
      .json({ error: "ต้องระบุ branchId, userId (หรือ employeeId), paymentMethod" });
  }
  const hasInvalidItem = items.some(
    (item) =>
      typeof item.menuId !== "number" ||
      typeof item.quantity !== "number" ||
      item.quantity <= 0,
  );
  if (hasInvalidItem) {
    // ต้องเช็คชนิดข้อมูลตรงนี้ ไม่ใช่แค่เช็คว่ามีค่า เพราะ "2" + "3" ในภายหลัง
    // จะกลายเป็น string concatenation ("23") ไม่ใช่ผลรวมตัวเลข (5)
    // ทำให้การเช็คสต็อกผิดพลาดแบบเงียบๆ หาก frontend ส่ง quantity มาเป็น string
    return res
      .status(400)
      .json({ error: "menuId และ quantity ของทุกรายการต้องเป็นตัวเลข" });
  }

  try {
    // รวมจำนวนของรายการที่เป็นเมนูเดียวกัน ก่อนเช็คสต็อก
    // ป้องกันกรณีสั่งเมนูเดียวกันหลายบรรทัดแล้วแต่ละบรรทัดเช็คผ่านแยกกัน
    // ทั้งที่ผลรวมทั้งหมดเกินสต็อกจริง
    const quantityByMenuId = new Map();
    for (const item of items) {
      quantityByMenuId.set(
        item.menuId,
        (quantityByMenuId.get(item.menuId) || 0) + item.quantity,
      );
    }

    const menuIds = [...quantityByMenuId.keys()];
    // กรองด้วย branch_id ด้วยเสมอ ไม่ใช่แค่ menu_id — เมนูของแต่ละสาขาเป็นคนละแถวกัน
    // ตาม wk07.md หัวข้อ 3.2 (schema ตาราง menu_item) หาก client ส่ง menuId ของสาขาอื่นมาปน
    // แถวนั้นจะไม่ถูกดึงเข้า menuMap เลย แล้วเงื่อนไข !menu ด้านล่างจะปฏิเสธออเดอร์ด้วย 400 โดยอัตโนมัติ
    const menuRows = await menuModel.findManyForStockCheck(menuIds, effectiveBranchId);
    const menuMap = new Map(menuRows.map((row) => [row.menu_id, row]));

    for (const [menuId, totalQuantity] of quantityByMenuId) {
      const menu = menuMap.get(menuId);
      if (!menu || menu.stock_quantity < totalQuantity) {
        return res.status(400).json({
          error: `สต็อกไม่เพียงพอสำหรับเมนู id ${menuId}`,
        });
      }
    }

    const effectiveMemberId = memberId ? Number(memberId) : null;
    const orderId = await orderModel.create(effectiveBranchId, currentUserId, paymentMethod, effectiveMemberId);

    let orderSubtotal = 0;
    for (const item of items) {
      const menu = menuMap.get(item.menuId);
      const itemNotes = item.notes || item.desc || null;
      await orderModel.addItem(orderId, item.menuId, item.quantity, menu.price, itemNotes);
      // ไม่ต้องเพิ่ม branchId ตรงนี้ซ้ำอีก เพราะ item.menuId ที่วนอยู่นี้
      // ผ่านการกรองด้วย branch_id มาแล้วที่ findManyForStockCheck ด้านบน
      // ต่างจาก updateMenu/deleteMenu ที่รับ menu_id ตรงจาก req.params โดยยังไม่ผ่านการกรองใด ๆ
      await menuModel.deductStock(item.menuId, item.quantity);
      orderSubtotal += Number(menu.price) * item.quantity;
    }

    // หากเป็นสมาชิก Cafe Club ให้สะสมแต้ม (1 แต้ม ต่อทุกๆ 50 บาท หลังหักส่วนลด 5%)
    let pointsEarned = 0;
    if (effectiveMemberId) {
      try {
        pointsEarned = Math.floor((orderSubtotal * 0.95) / 50);
        if (pointsEarned > 0) {
          await memberModel.addPoints(effectiveMemberId, pointsEarned);
        }
      } catch (e) {
        console.warn("Could not award member points:", e.message);
      }
    }

    const lowStockMenuIds = [];
    for (const [menuId, totalQuantity] of quantityByMenuId) {
      const menu = menuMap.get(menuId);
      if (menu.stock_quantity - totalQuantity < 10) {
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
    console.error(err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการบันทึกออเดอร์" });
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

    const queue = await orderModel.getBaristaQueue(branchId);
    res.json({ success: true, queue });
  } catch (err) {
    console.error("Get Barista Queue Error:", err);
    res.status(500).json({ success: false, error: "เกิดข้อผิดพลาดในการดึงคิวออเดอร์ของบาริสต้า" });
  }
};

/**
 * อัปเดตสถานะออเดอร์ (pending -> preparing -> ready -> completed)
 * PATCH /api/orders/:id/status
 */
exports.updateOrderStatus = async (req, res) => {
  const orderId = Number(req.params.id);
  const { status } = req.body || {};

  const allowedStatuses = ["pending", "preparing", "ready", "completed", "cancelled"];
  if (!status || !allowedStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      error: `สถานะไม่ถูกต้อง รองรับเฉพาะ: ${allowedStatuses.join(", ")}`,
    });
  }

  try {
    const success = await orderModel.updateStatus(orderId, status);
    if (!success) {
      return res.status(404).json({ success: false, error: "ไม่พบข้อมูลออเดอร์นี้ในระบบ" });
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
