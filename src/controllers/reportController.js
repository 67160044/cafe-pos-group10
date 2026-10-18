// src/controllers/reportController.js
const reportModel = require("../models/reportModel");

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ALLOWED_TOP_FILTERS = ["all", "day", "week"];

// ตรวจว่าเป็นวันที่รูปแบบ YYYY-MM-DD ที่มีอยู่จริง (เช่น ไม่รับ 2026-02-31)
function isValidDate(value) {
  if (typeof value !== "string" || !DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

exports.getSalesReport = async (req, res) => {
  const { from, to, branchId, top } = req.query;

  if (!from || !to) {
    return res.status(400).json({ error: "ต้องระบุช่วงวันที่ from และ to" });
  }
  if (!isValidDate(from) || !isValidDate(to)) {
    return res
      .status(400)
      .json({ error: "รูปแบบวันที่ต้องเป็น YYYY-MM-DD และเป็นวันที่ที่มีอยู่จริง" });
  }

  if (from > to) {
    return res
      .status(400)
      .json({ error: "วันที่เริ่มต้น (from) ต้องไม่เกินวันที่สิ้นสุด (to)" });
  }

  if (top !== undefined && !ALLOWED_TOP_FILTERS.includes(top)) {
    return res
      .status(400)
      .json({ error: `top ต้องเป็นหนึ่งใน: ${ALLOWED_TOP_FILTERS.join(", ")}` });
  }

  // route นี้จำกัดเฉพาะ manager จึงเลือกดูทุกสาขา (ไม่ระบุ branchId) หรือเฉพาะสาขาที่ระบุได้
  let targetBranchId = null;
  if (branchId !== undefined && branchId !== "" && branchId !== "all") {
    if (!/^\d+$/.test(String(branchId)) || Number(branchId) <= 0) {
      return res.status(400).json({ error: "branchId ต้องเป็นจำนวนเต็มบวกหรือ all" });
    }
    targetBranchId = Number(branchId);
  }

  try {
    const reportData = await reportModel.getSalesReport({
      from,
      to,
      branchId: targetBranchId,
      topFilter: top || "all",
    });
    res.json(reportData);
  } catch (err) {
    console.error("เกิดข้อผิดพลาดในการคำนวณรายงานยอดขาย:", err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลรายงานยอดขาย" });
  }
};
