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

  // จัดการสิทธิ์การดูสาขา:
  // - Admin: ไม่สามารถเปลี่ยนสาขาได้ แยกตามพนักงานสาขานั้นๆ (บังคับดูเฉพาะ branchId ของตนเอง)
  // - Manager: สามารถดู report ได้ของทุกสาขา (null = ทุกสาขา หรือเลือกสาขาที่ต้องการได้)
  let targetBranchId = branchId ? Number(branchId) : null;
  if (req.user && req.user.role === "admin") {
    targetBranchId = Number(req.user.branchId || 1);
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
