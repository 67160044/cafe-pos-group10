// src/controllers/menuController.js
const menuModel = require("../models/menuModel");

exports.listMenu = async (req, res) => {
  const { branchId } = req.query;
  if (!branchId) {
    return res.status(400).json({ error: "ต้องระบุ branchId" });
  }
  try {
    const rows = await menuModel.findAllByBranch(branchId);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลเมนู" });
  }
};

exports.getMenuById = async (req, res) => {
  const { branchId } = req.query;
  if (!branchId) {
    return res.status(400).json({ error: "ต้องระบุ branchId" });
  }
  try {
    const menu = await menuModel.findByIdAndBranch(req.params.id, branchId);
    if (!menu) {
      return res
        .status(404)
        .json({ error: `ไม่พบเมนู id ${req.params.id} ในสาขานี้` });
    }
    res.json(menu);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลเมนู" });
  }
};

exports.createMenu = async (req, res) => {
  const { branchId, categoryId, name, price, stockQuantity } = req.body;
  if (!branchId) {
    return res.status(400).json({ error: "ต้องระบุ branchId" });
  }
  if (typeof price !== "number" || price <= 0) {
    return res.status(400).json({ error: "price ต้องเป็นตัวเลขมากกว่า 0" });
  }
  try {
    const menuId = await menuModel.create(
      branchId,
      categoryId,
      name,
      price,
      stockQuantity,
    );
    res.status(201).json({ menuId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการเพิ่มเมนู" });
  }
};

exports.updateMenu = async (req, res) => {
  // ใช้ COALESCE ใน menuModel.updateFields เพื่อรองรับการแก้ไขบางฟิลด์ (partial update)
  // เช่น หน้าจอที่มีปุ่ม "แก้ไขเฉพาะราคา" ส่งมาแค่ { price: 50 }
  // หากไม่ทำเช่นนี้ ฟิลด์ที่ไม่ได้ส่งมาจะกลายเป็น undefined แล้วถูกบันทึกเป็น NULL ทับค่าเดิม
  //
  // หมายเหตุ: endpoint นี้ผูกกับ router.put("/:id", ...) แต่พฤติกรรม partial update
  // ข้างต้นตรงกับความหมายของ PATCH ตามหลัก REST ไม่ใช่ PUT (ซึ่งควรบังคับส่งข้อมูลครบทุก field)
  // สังเกตไว้ก่อน — เป็นตัวอย่างหนึ่งของจุดที่โค้ดทำงานได้จริงแต่ไม่สอดคล้องกับความหมายของตัวเอง
  // จะกลับมาตรวจสอบจุดลักษณะนี้อย่างเป็นระบบอีกครั้งในสัปดาห์ที่ 14 (การตรวจสอบคุณภาพซอฟต์แวร์)
  const { branchId, name, price, stockQuantity } = req.body;
  if (!branchId) {
    return res.status(400).json({ error: "ต้องระบุ branchId" });
  }
  try {
    const affectedRows = await menuModel.updateFields(req.params.id, branchId, {
      name,
      price,
      stockQuantity,
    });
    if (affectedRows === 0) {
      return res
        .status(404)
        .json({ error: `ไม่พบเมนู id ${req.params.id} ในสาขานี้` });
    }
    res.json({ updated: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการแก้ไขเมนู" });
  }
};

exports.deleteMenu = async (req, res) => {
  const { branchId } = req.query;
  if (!branchId) {
    return res.status(400).json({ error: "ต้องระบุ branchId" });
  }
  try {
    const affectedRows = await menuModel.remove(req.params.id, branchId);
    if (affectedRows === 0) {
      return res
        .status(404)
        .json({ error: `ไม่พบเมนู id ${req.params.id} ในสาขานี้` });
    }
    res.json({ deleted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการลบเมนู" });
  }
};
