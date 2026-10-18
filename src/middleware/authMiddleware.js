// src/middleware/authMiddleware.js
const crypto = require("crypto");

// ไม่ใช้ secret สำรองที่เขียนตายตัวในโค้ด: ถ้าไม่ได้ตั้ง JWT_SECRET จะสุ่มค่าใหม่ทุกครั้งที่เริ่มเซิร์ฟเวอร์
// (token เดิมจะใช้ไม่ได้หลังรีสตาร์ต) และบังคับให้ตั้งค่าใน production
let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("ต้องตั้งค่า JWT_SECRET ในไฟล์ .env ก่อนรันแบบ production");
  }
  JWT_SECRET = crypto.randomBytes(32).toString("hex");
  console.warn("คำเตือน: ไม่พบ JWT_SECRET ใน .env ใช้ secret ชั่วคราวที่สุ่มขึ้นใหม่ (ต้องล็อกอินใหม่หลังรีสตาร์ต)");
}

function createToken(user) {
  const payload = Buffer.from(
    JSON.stringify({
      userId: user.user_id || user.userId || user.employee_id || user.employeeId,
      employeeId: user.user_id || user.userId || user.employee_id || user.employeeId,
      name: user.name,
      email: user.email,
      role: user.role,
      branchId: user.branch_id || user.branchId,
      branchName: user.branch_name || user.branchName || "",
      exp: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    })
  ).toString("base64url");

  const signature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(payload)
    .digest("base64url");

  return `${payload}.${signature}`;
}

function decodeToken(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [payload, signature] = parts;
  const expectedSig = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(payload)
    .digest("base64url");

  const sigBuf = Buffer.from(String(signature));
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (data.exp && Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}

// Middleware: ตรวจสอบ Token (optional หรือ strict)
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  let token = null;

  // รับ token เฉพาะจาก Authorization header (ไม่รับทาง query string เพราะไปติดใน log และประวัติเบราว์เซอร์)
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.substring(7).trim();
  }

  if (token) {
    const user = decodeToken(token);
    if (user) {
      req.user = user;
    }
  }
  next();
}

// Middleware: บังคับต้อง Login
function requireAuth(req, res, next) {
  authenticate(req, res, () => {
    if (!req.user) {
      return res.status(401).json({
        error: "กรุณาเข้าสู่ระบบก่อนทำรายการ",
        code: "UNAUTHORIZED",
      });
    }
    next();
  });
}

// Middleware: ตรวจสอบสิทธิ์ตาม Role เช่น requireRole(['admin', 'manager'])
function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    requireAuth(req, res, () => {
      const userRole = req.user?.role;
      if (!userRole || !allowedRoles.includes(userRole)) {
        return res.status(403).json({
          error: `สิทธิ์ของคุณ (${userRole || "ไม่มีสิทธิ์"}) ไม่สามารถเข้าถึงหรือทำรายการนี้ได้ (ต้องการสิทธิ์: ${allowedRoles.join(
            " หรือ "
          )})`,
          code: "FORBIDDEN",
        });
      }
      next();
    });
  };
}

module.exports = {
  createToken,
  decodeToken,
  authenticate,
  requireAuth,
  requireRole,
};
