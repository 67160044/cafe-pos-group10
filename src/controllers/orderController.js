// src/controllers/orderController.js (ปรับปรุงจาก Sprint 1 ตาม schema wk07.md ให้เรียกผ่าน Model)
const menuModel = require("../models/menuModel");
const orderModel = require("../models/orderModel");

exports.createOrder = async (req, res) => {
  const { items, paymentMethod, employeeId, branchId } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res
      .status(400)
      .json({ error: "ต้องมีรายการสินค้าอย่างน้อย 1 รายการ" });
  }
  if (!branchId || !employeeId || !paymentMethod) {
    return res
      .status(400)
      .json({ error: "ต้องระบุ branchId, employeeId, paymentMethod" });
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
    const menuRows = await menuModel.findManyForStockCheck(menuIds, branchId);
    const menuMap = new Map(menuRows.map((row) => [row.menu_id, row]));

    for (const [menuId, totalQuantity] of quantityByMenuId) {
      const menu = menuMap.get(menuId);
      if (!menu || menu.stock_quantity < totalQuantity) {
        return res.status(400).json({
          error: `สต็อกไม่เพียงพอสำหรับเมนู id ${menuId}`,
        });
      }
    }

    const orderId = await orderModel.create(branchId, employeeId, paymentMethod);

    for (const item of items) {
      const menu = menuMap.get(item.menuId);
      await orderModel.addItem(orderId, item.menuId, item.quantity, menu.price);
      // ไม่ต้องเพิ่ม branchId ตรงนี้ซ้ำอีก เพราะ item.menuId ที่วนอยู่นี้
      // ผ่านการกรองด้วย branch_id มาแล้วที่ findManyForStockCheck ด้านบน
      // ต่างจาก updateMenu/deleteMenu ที่รับ menu_id ตรงจาก req.params โดยยังไม่ผ่านการกรองใด ๆ
      await menuModel.deductStock(item.menuId, item.quantity);
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

    res.status(201).json({ orderId, lowStockMenuIds });
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
