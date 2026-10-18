// src/utils/password.js
// เก็บรหัสผ่านแบบ hash ด้วย scrypt ของ Node.js (ไม่ต้องติดตั้งไลบรารีเพิ่ม)
// รูปแบบที่เก็บ: s1$<salt base64url>$<hash base64url>
const crypto = require("crypto");

const PREFIX = "s1$";
const KEY_LENGTH = 32;

function hashPassword(plain) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(plain), salt, KEY_LENGTH);
  return `${PREFIX}${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

function isHashed(stored) {
  return typeof stored === "string" && stored.startsWith(PREFIX);
}

function verifyPassword(plain, stored) {
  if (typeof plain !== "string" || typeof stored !== "string") return false;

  if (!isHashed(stored)) {
    // ข้อมูลเดิมที่ยังเป็น plaintext: เทียบแบบ timing-safe เพื่อให้ผู้เรียกอัปเกรดเป็น hash ต่อ
    const a = Buffer.from(plain);
    const b = Buffer.from(stored);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  const [, saltB64, hashB64] = stored.split("$");
  if (!saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64url");
  const actual = crypto.scryptSync(plain, Buffer.from(saltB64, "base64url"), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

module.exports = { hashPassword, verifyPassword, isHashed };
