## AI Usage Declaration — Coding Sprint สัปดาห์ที่ 9

### 1. Diagram/เอกสารต้นทางของ sprint นี้:
Sequence Diagram ของ flow การสั่งซื้อ ต่อยอดจาก Use Case Diagram สัปดาห์ที่ 4 (รับออเดอร์และคำนวณราคา) และ ER Diagram สัปดาห์ที่ 7 โดยอ้างอิงตาราง `menu_item`, `orders` และ `order_item` ใน schema.sql

### 2. ส่วนที่ AI ช่วยเขียนโค้ด:
- `src/models/menuModel.js` — เพิ่ม `findManyForStockCheck`, `deductStock`, และ CRUD เมนู (`findAllByBranch`, `findByIdAndBranch`, `create`, `updateFields`, `remove`)
- `src/controllers/menuController.js` — สร้างใหม่ทั้งไฟล์ (CRUD เมนู 5 endpoint)
- `src/routes/menuRoutes.js` — สร้างใหม่ทั้งไฟล์
- `src/app.js` — เพิ่ม route `/api/menu`
- `src/controllers/orderController.js` — ปรับปรุง `createOrder` ให้เรียกผ่าน Model, ดึงราคาจาก DB แทนรับจาก client, เช็ค/ตัดสต็อก

### 3. สมาชิกที่อธิบายโค้ดส่วนนี้ได้ (ต้องมีอย่างน้อย 1 คนต่อส่วน):
ดนัยวัฒน์ เพ็ชรหนองชุม (67160184)

### 4. โค้ด/schema/สถาปัตยกรรมมีจุดใดต่างจาก diagram เดิมหรือไม่:
- [x] ไม่ต่าง — โค้ดที่ implement จริงตรงกับ Sequence Diagram ทุกข้อความ/เงื่อนไข/loop ตามที่จับคู่ไว้ในหัวข้อ 4.2 ของ wk09.md
- [ ] ต่าง

### 5. ลิงก์ Repository

[https://github.com/67160044/cafe-pos-group10](https://github.com/67160044/cafe-pos-group10)

---

