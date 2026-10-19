## AI Usage Declaration - Coding Sprint สัปดาห์ที่ 5

### 1. Diagram/เอกสารต้นทางของ sprint นี้:

Use Case Diagram และ User Story จากไฟล์ `wk04-user-stories.md` (ครอบคลุม US-01: เลือกเมนูและตัวเลือกเครื่องดื่ม และ US-02: การคำนวณเงินและยอดสุทธิ)

### 2. ส่วนที่ AI ช่วยเขียนโค้ด:

- **ไฟล์:** `src/routes/orderRoutes.js` (การกำหนด Endpoint `POST /api/orders` )
- **ไฟล์:** `schema.sql` และ `docker-compose.yml` (โครงสร้างฐานข้อมูลและ Docker environment)

### 3. สมาชิกที่อธิบายโค้ดส่วนนี้ได้ (ต้องมีอย่างน้อย 1 คนต่อส่วน):

- นายสมพงษ์ เหลืองอ่อน รหัสนิสิต 67160044
- นายดนัยวัฒน์ เพ็ชรหนองชุม รหัสนิสิต 67160184

### 4. โค้ด/schema/สถาปัตยกรรมมีจุดใดต่างจาก diagram เดิมหรือไม่:

- [ ] ไม่ต่าง
- [x] ต่าง - เหตุผล: ในสัปดาห์ที่ 5 ตาราง `orders` ในฐานข้อมูลจะเก็บเฉพาะข้อมูลระดับออเดอร์ (`payment_method`, `total_amount`, `created_at`) โดยยังไม่มีตารางย่อย `order_items` สำหรับเก็บรายการสินค้าหรือท็อปปิ้งแยกเป็นรายชิ้น และได้ปรับปรุง diagram สัปดาห์นี้ให้ตรงแล้ว: [ ] แล้ว [x] ยังไม่ได้ปรับ

### 5. ผลการทดสอบ Endpoint

![ผลการทดสอบ API](<../images/ทดสอบ endpoint Wk05.jpg>)

### 6. ลิงก์ Repository

[https://github.com/67160044/cafe-pos-group10](https://github.com/67160044/cafe-pos-group10)
