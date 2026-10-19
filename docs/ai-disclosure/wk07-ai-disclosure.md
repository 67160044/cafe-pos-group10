## การใช้ AI ในงานนี้ (AI Usage Declaration)

### 1. ใช้ AI หรือไม่?

- [ ] ไม่ได้ใช้ AI
- [X] ใช้ AI (กรุณาระบุรายละเอียด)

### 2. เครื่องมือ AI ที่ใช้:

- Claude (Claude Code)

### 3. งานส่วนไหนใช้ AI:

- [ ] Requirement Analysis - ส่วน: -
- [X] Database Design - ส่วน: ใช้ AI ช่วยทำ ER Diagram อย่างเดียว คือสร้างไฟล์ StarUML ของ ER Diagram ตามตารางใน `schema.sql` ที่มีอยู่แล้ว เพื่อนำไป export เป็นรูป `wk07-er-diagram.png`
- [ ] System Architecture - ส่วน: -
- [ ] Document/Grammar Check - ส่วน: -
- [ ] อื่นๆ: - (ส่วนอื่นของ wk07 ไม่ได้ใช้ AI)

### 4. Prompt ที่ใช้ (ตัวอย่าง):

"ER Diagram ต้องสร้างใน staruml นะ"


### 5. ผลลัพธ์จาก AI:

AI สร้างไฟล์ StarUML ที่วาดตารางและความสัมพันธ์ตาม `schema.sql` ที่มีอยู่ ให้เปิดแก้ต่อได้

### 6. การปรับแต่งของนิสิตเอง:

- เปิดไฟล์ใน StarUML แล้ว export เป็นรูป `wk07-er-diagram.png` เอง
- ดนัยวัฒน์ เพ็ชรหนองชุม (67160184) อธิบาย ER Diagram ได้ ว่าแต่ละตารางเก็บอะไร และเชื่อมกันด้วย key ไหน

### 7. เหตุผลในการใช้ AI:

ให้ AI ช่วยทำ ER Diagram ตาม `schema.sql` ที่มีอยู่แล้ว เพราะวาดเองใน StarUML ใช้เวลานาน ส่วนงานอื่นของ wk07 ทำเอง
