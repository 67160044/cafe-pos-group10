## AI Usage Declaration — Coding Sprint สัปดาห์ที่ 13

### 1. Diagram/เอกสารต้นทางของ sprint นี้:

- Sequence Diagram การสั่งซื้อ (สัปดาห์ 9) และ Sequence Diagram รายงานยอดขาย (สัปดาห์ 10)
- Use Case Diagram และ Acceptance Criteria (`wk04-user-stories.md`) และ Requirements Document (`wk03-requirements.md`)
- รายการปัญหาจาก `wk12-usability-testing.md`

### 2. ส่วนที่ AI ช่วยเขียนโค้ด:

- AI (Claude) ช่วยเขียนสคริปต์ทดสอบเรียก API ชั่วคราวสำหรับรัน test case End-to-End (ขั้นตอนที่ 1-6 ของ `wk13.md` หัวข้อ 2.3) สคริปต์นี้ไม่ได้เก็บใน repository
- AI (Claude) ช่วยออกแบบ test case และร่าง FR-11, FR-12 พร้อม Change Log ใน `wk03-requirements.md`
- หลังจากทดสอบ AI ยังช่วยแก้ไขโค้ด backend ใน `src/` (routes, controllers, models, middleware) เพื่อแก้บั๊กและช่องโหว่ที่พบ รายละเอียดทั้งหมดอยู่ใน `wk14-ai-disclosure.md` และ `wk14-quality-review.md`


### 3. สมาชิกที่อธิบายโค้ดส่วนนี้ได้ (ต้องมีอย่างน้อย 1 คนต่อส่วน):

- ดนัยวัฒน์ เพ็ชรหนองชุม (67160184)

### 4. โค้ด/schema/สถาปัตยกรรมมีจุดใดต่างจาก diagram เดิมหรือไม่:

- [ ] ไม่ต่าง
- [X] ต่าง — เหตุผล: (1) ชื่อ field ใน response ของ `GET /api/menu` และ `GET /api/reports/sales` เดิมเป็น snake_case ไม่ตรงข้อตกลง camelCase (พบจาก TC-13-01) ปัจจุบันปรับเป็น camelCase ทั้ง backend และ frontend แล้ว (2) schema ที่ใช้งานจริงใน `schema.sql` ขยายจาก ER Diagram/`wk07-schema.sql` เดิม คือใช้ตาราง `user` แทน `employee`, เพิ่มตาราง `member`, ตาราง `orders` มีคอลัมน์ `user_id`, `member_id`, `status` และ `order_item` มีคอลัมน์ `notes` และได้ปรับปรุง diagram สัปดาห์นี้ให้ตรงแล้ว: [ ] แล้ว [X] ยังไม่ได้ปรับ (ข้อ 1 ปรับโค้ดแล้ว ส่วนข้อ 2 ER Diagram และ `wk07-schema.sql` ยังเป็นเวอร์ชันเดิม)

**หมายเหตุ:** Use Case Diagram ใน `wk04-user-stories.md` ได้รับการปรับปรุงในสัปดาห์นี้ (ไฟล์ `wk04-use-case-diagram.png`) AI ช่วยสร้างรูปและไฟล์ StarUML จาก diagram ที่กลุ่มกำหนดข้อความและโครงสร้างเอง

### 5. ลิงก์ Repository

[https://github.com/67160044/cafe-pos-group10](https://github.com/67160044/cafe-pos-group10)