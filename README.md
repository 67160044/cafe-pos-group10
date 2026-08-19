# 🚀 ขั้นตอนการติดตั้งและรันโปรเจกต์ Cafe POS (สำหรับสมาชิกในกลุ่ม)

คู่มือสำหรับสมาชิกในกลุ่มที่ Clone โปรเจกต์นี้ไปรันต่อที่เครื่องตัวเอง

---

## 🛠️ สิ่งที่ต้องมีในเครื่อง (Prerequisites)

* **Node.js** (เวอร์ชัน 18 ขึ้นไป)
* **MySQL Server** และโปรแกรมจัดการฐานข้อมูล เช่น **MySQL Workbench** หรือ **DBeaver**

---

## 📦 1. ติดตั้ง Package เพิ่มเติม

หลังจาก Clone Repository ไปแล้ว ให้เปิด Terminal ในโฟลเดอร์โปรเจกต์แล้วรันคำสั่งด้านล่างเพื่อติดตั้ง Library ทั้งหมดที่จำเป็น (`express`, `mysql2`, `dotenv` ฯลฯ):

```bash
npm install

```

## ⚙️ 2. ตั้งค่าไฟล์ตัวแปรสภาพแวดล้อม (`.env`)

เนื่องจากไฟล์ `.env` ไม่ได้ถูก push ขึ้น GitHub ให้สร้างไฟล์ชื่อ **`.env`** ขึ้นมาใหม่ที่ Root Directory (โฟลเดอร์เดียวกับ `package.json`) แล้วคัดลอกข้อความด้านล่างนี้ไปวาง:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=ใส่รหัสผ่าน_MYSQL_ของเครื่องตัวเอง
DB_NAME=cafe_pos
PORT=3000
```

## 🗄️ 3. จัดเตรียมฐานข้อมูล MySQL

เปิดโปรแกรม **MySQL Workbench** หรือ **DBeaver** แล้วเปิด Query Window รันคำสั่ง SQL ด้านล่างนี้เพื่อสร้าง Database และ Table:

```sql
-- 1. สร้างฐานข้อมูล
CREATE DATABASE IF NOT EXISTS cafe_pos;
USE cafe_pos;

-- 2. สร้างตาราง orders สำหรับ Sprint 1
CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  payment_method VARCHAR(20) NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL
);

## ▶️ 4. สั่งรัน Server

เมื่อตั้งค่า `.env` และสร้างตารางใน MySQL เรียบร้อยแล้ว ให้สั่งรันแอปพลิเคชันด้วยคำสั่ง:

```bash
npm run dev
```

หากตั้งค่าถูกต้อง หน้าจอ Terminal จะแสดงข้อความ:

**Cafe POS server running on port 3000**

## 🧪 5. การทดสอบ API (`POST /api/orders`)

ทดสอบยิง Request ผ่าน **Postman** หรือ **Thunder Client** ไปที่:

* **URL:** `http://localhost:3000/api/orders`
* **Method:** `POST`
* **Headers:** `Content-Type: application/json`
* **Body (raw JSON):**

```json
{
  "paymentMethod": "cash",
  "items": [
    { "name": "อเมริกาโน่", "price": 45, "quantity": 2 },
    { "name": "ครัวซองต์", "price": 35, "quantity": 1 }
  ]
}

หากสำเร็จ จะได้รับ Response สถานะ 201 Created พร้อมคืนค่า orderId และ totalAmount

{
  "orderId": 1,
  "totalAmount": 125
}