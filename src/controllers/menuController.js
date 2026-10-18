// src/controllers/menuController.js
const menuModel = require("../models/menuModel");

const isPositiveInt = (v) => Number.isInteger(v) && v > 0;

// แปลงแถวจากฐานข้อมูล (snake_case) เป็น JSON ตามข้อตกลง (camelCase) และแปลง DECIMAL เป็นตัวเลข
const toMenuDto = (row) => ({
  menuId: row.menu_id,
  branchId: row.branch_id,
  categoryId: row.category_id,
  name: row.name,
  price: Number(row.price),
  stockQuantity: row.stock_quantity,
  categoryName: row.category_name ?? null,
});
const parseId = (v) => (/^\d+$/.test(String(v ?? "")) ? Number(v) : NaN);

// แคชเชียร์/บาริสต้าดูเมนูได้เฉพาะสาขาของตนเอง ส่วน manager/admin เลือกสาขาได้
function resolveReadBranchId(req) {
  const role = req.user?.role;
  if (role === "cashier" || role === "barista") {
    return Number(req.user.branchId);
  }
  return parseId(req.query.branchId);
}

// ตรวจค่าของ field ที่ส่งมา (ใช้ทั้งตอนเพิ่มและแก้ไข) คืนข้อความ error หรือ null
function validateMenuFields({ categoryId, name, price, stockQuantity }, { partial }) {
  if (!partial || categoryId !== undefined) {
    if (!isPositiveInt(categoryId)) return "categoryId ต้องเป็นจำนวนเต็มบวก";
  }
  if (!partial || name !== undefined) {
    if (typeof name !== "string" || !name.trim() || name.trim().length > 100) {
      return "name ต้องเป็นข้อความที่ไม่ว่างและยาวไม่เกิน 100 ตัวอักษร";
    }
  }
  if (!partial || price !== undefined) {
    if (typeof price !== "number" || !Number.isFinite(price) || price <= 0 || price > 100000) {
      return "price ต้องเป็นตัวเลขมากกว่า 0";
    }
  }
  if (stockQuantity !== undefined) {
    if (!Number.isInteger(stockQuantity) || stockQuantity < 0 || stockQuantity > 1000000) {
      return "stockQuantity ต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป";
    }
  }
  return null;
}

exports.listMenu = async (req, res) => {
  const branchId = resolveReadBranchId(req);
  if (!isPositiveInt(branchId)) {
    return res.status(400).json({ error: "ต้องระบุ branchId ที่ถูกต้อง" });
  }
  try {
    const rows = await menuModel.findAllByBranch(branchId);
    res.json(rows.map(toMenuDto));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลเมนู" });
  }
};

exports.getMenuById = async (req, res) => {
  const branchId = resolveReadBranchId(req);
  const menuId = parseId(req.params.id);
  if (!isPositiveInt(branchId) || !isPositiveInt(menuId)) {
    return res.status(400).json({ error: "ต้องระบุ branchId และรหัสเมนูที่ถูกต้อง" });
  }
  try {
    const menu = await menuModel.findByIdAndBranch(menuId, branchId);
    if (!menu) {
      return res
        .status(404)
        .json({ error: `ไม่พบเมนู id ${menuId} ในสาขานี้` });
    }
    res.json(toMenuDto(menu));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลเมนู" });
  }
};

exports.createMenu = async (req, res) => {
  const { branchId, categoryId, name, price, stockQuantity } = req.body || {};
  if (!isPositiveInt(branchId)) {
    return res.status(400).json({ error: "ต้องระบุ branchId ที่ถูกต้อง" });
  }
  const invalid = validateMenuFields({ categoryId, name, price, stockQuantity }, { partial: false });
  if (invalid) {
    return res.status(400).json({ error: invalid });
  }
  try {
    const menuId = await menuModel.create(
      branchId,
      categoryId,
      name.trim(),
      price,
      stockQuantity,
    );
    res.status(201).json({ menuId });
  } catch (err) {
    if (err.code === "ER_NO_REFERENCED_ROW_2") {
      return res.status(400).json({ error: "ไม่พบสาขาหรือหมวดหมู่ที่ระบุ" });
    }
    console.error(err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการเพิ่มเมนู" });
  }
};

exports.updateMenu = async (req, res) => {
  // ใช้ COALESCE ใน menuModel.updateFields เพื่อรองรับการแก้ไขบางฟิลด์ (partial update)
  // เช่น หน้าจอที่มีปุ่ม "แก้ไขเฉพาะราคา" ส่งมาแค่ { price: 50 }
  // หมายเหตุ: พฤติกรรม partial update ตรงกับความหมายของ PATCH ตามหลัก REST
  // route จึงรองรับทั้ง PUT (ที่หน้าจอเดิมเรียกใช้) และ PATCH
  const { branchId, categoryId, name, price, stockQuantity } = req.body || {};
  const menuId = parseId(req.params.id);
  if (!isPositiveInt(branchId) || !isPositiveInt(menuId)) {
    return res.status(400).json({ error: "ต้องระบุ branchId และรหัสเมนูที่ถูกต้อง" });
  }
  if ([categoryId, name, price, stockQuantity].every((v) => v === undefined)) {
    return res.status(400).json({ error: "ต้องระบุข้อมูลที่ต้องการแก้ไขอย่างน้อย 1 รายการ" });
  }
  const invalid = validateMenuFields({ categoryId, name, price, stockQuantity }, { partial: true });
  if (invalid) {
    return res.status(400).json({ error: invalid });
  }
  try {
    const affectedRows = await menuModel.updateFields(menuId, branchId, {
      categoryId,
      name: typeof name === "string" ? name.trim() : name,
      price,
      stockQuantity,
    });
    if (affectedRows === 0) {
      return res
        .status(404)
        .json({ error: `ไม่พบเมนู id ${menuId} ในสาขานี้` });
    }
    res.json({ updated: true });
  } catch (err) {
    if (err.code === "ER_NO_REFERENCED_ROW_2") {
      return res.status(400).json({ error: "ไม่พบหมวดหมู่ที่ระบุ" });
    }
    console.error(err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการแก้ไขเมนู" });
  }
};

exports.deleteMenu = async (req, res) => {
  const branchId = parseId(req.query.branchId);
  const menuId = parseId(req.params.id);
  if (!isPositiveInt(branchId) || !isPositiveInt(menuId)) {
    return res.status(400).json({ error: "ต้องระบุ branchId และรหัสเมนูที่ถูกต้อง" });
  }
  try {
    const affectedRows = await menuModel.remove(menuId, branchId);
    if (affectedRows === 0) {
      return res
        .status(404)
        .json({ error: `ไม่พบเมนู id ${menuId} ในสาขานี้` });
    }
    res.json({ deleted: true });
  } catch (err) {
    if (err.code === "ER_ROW_IS_REFERENCED_2") {
      return res.status(409).json({
        error: "ลบเมนูนี้ไม่ได้ เพราะมีประวัติการขายอ้างอิงอยู่ (แนะนำให้ปรับสต็อกเป็น 0 แทน)",
      });
    }
    console.error(err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการลบเมนู" });
  }
};
