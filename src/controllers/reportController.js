// src/controllers/reportController.js
const reportModel = require("../models/reportModel");

exports.getSalesReport = async (req, res) => {
  const { from, to, branchId, top } = req.query;

  if (!from || !to) {
    return res.status(400).json({ error: "ต้องระบุช่วงวันที่ from และ to" });
  }

  if (from > to) {
    return res
      .status(400)
      .json({ error: "วันที่เริ่มต้น (from) ต้องไม่เกินวันที่สิ้นสุด (to)" });
  }

  try {
    const reportData = await reportModel.getSalesReport({
      from,
      to,
      branchId: branchId ? Number(branchId) : null,
      topFilter: top || "all",
    });
    res.json(reportData);
  } catch (err) {
    console.error("เกิดข้อผิดพลาดในการคำนวณรายงานยอดขาย:", err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลรายงานยอดขาย" });
  }
};
