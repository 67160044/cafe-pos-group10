// src/controllers/memberController.js
const memberModel = require("../models/memberModel");

/**
 * ตรวจสอบว่าเป็นสมาชิก Cafe Club จริงหรือไม่จากเบอร์โทรศัพท์
 * รองรับทั้ง GET /api/members/check/:phone และ GET /api/members/search?phone=...
 */
exports.checkMember = async (req, res) => {
  const phone = (req.params.phone || req.query.phone || "").trim();

  if (!phone) {
    return res.status(400).json({
      success: false,
      error: "กรุณาระบุหมายเลขโทรศัพท์ 10 หลักของสมาชิก",
    });
  }

  // ตรวจสอบรูปแบบเบอร์โทรศัพท์ 10 หลัก
  if (!/^\d{10}$/.test(phone)) {
    return res.status(400).json({
      success: false,
      error: "หมายเลขโทรศัพท์ต้องเป็นตัวเลข 10 หลักเท่านั้น",
    });
  }

  try {
    const member = await memberModel.findByPhone(phone);
    if (!member) {
      return res.status(404).json({
        success: false,
        error: "ไม่พบข้อมูลสมาชิกในระบบ Cafe Club (กรุณาตรวจสอบเบอร์โทรศัพท์)",
      });
    }

    return res.json({
      success: true,
      message: "ตรวจสอบพบสมาชิก Cafe Club ในฐานข้อมูล",
      member: {
        memberId: member.member_id,
        name: member.name,
        phone: member.phone,
        points: Number(member.points || 0),
        discountRate: Number(member.discount_rate || 0.05),
        joinedAt: member.joined_at,
      },
    });
  } catch (err) {
    console.error("Check Member Error:", err);
    return res.status(500).json({
      success: false,
      error: "เกิดข้อผิดพลาดในการตรวจสอบฐานข้อมูลสมาชิก",
    });
  }
};

/**
 * ดึงรายชื่อสมาชิกทั้งหมด
 */
exports.listMembers = async (req, res) => {
  try {
    const members = await memberModel.findAll();
    return res.json({
      success: true,
      members,
    });
  } catch (err) {
    console.error("List Members Error:", err);
    return res.status(500).json({
      success: false,
      error: "เกิดข้อผิดพลาดในการดึงข้อมูลสมาชิก",
    });
  }
};

/**
 * สมัครสมาชิกใหม่ Cafe Club
 * POST /api/members/register
 */
exports.registerMember = async (req, res) => {
  const { name, phone } = req.body || {};

  if (!name || !name.trim()) {
    return res.status(400).json({
      success: false,
      error: "กรุณาระบุชื่อ-นามสกุลของสมาชิก",
    });
  }

  const cleanPhone = (phone || "").trim();
  if (!cleanPhone || !/^\d{10}$/.test(cleanPhone)) {
    return res.status(400).json({
      success: false,
      error: "กรุณาระบุหมายเลขโทรศัพท์ 10 หลักให้ถูกต้อง",
    });
  }

  try {
    const existing = await memberModel.findByPhone(cleanPhone);
    if (existing) {
      return res.status(400).json({
        success: false,
        error: `หมายเลขโทรศัพท์นี้เป็นสมาชิกอยู่แล้ว (คุณ ${existing.name})`,
        member: {
          memberId: existing.member_id,
          name: existing.name,
          phone: existing.phone,
          points: Number(existing.points || 0),
          discountRate: Number(existing.discount_rate || 0.05),
        },
      });
    }

    const newMember = await memberModel.create({
      name: name.trim(),
      phone: cleanPhone,
    });

    return res.status(201).json({
      success: true,
      message: `สมัครสมาชิก Cafe Club สำเร็จเรียบร้อย (คุณ ${newMember.name})`,
      member: newMember,
    });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(400).json({
        success: false,
        error: "หมายเลขโทรศัพท์นี้เป็นสมาชิกอยู่แล้ว",
      });
    }
    console.error("Register Member Error:", err);
    return res.status(500).json({
      success: false,
      error: "เกิดข้อผิดพลาดในการบันทึกข้อมูลสมาชิก",
    });
  }
};

