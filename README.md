# ☕ Cafe POS & Smart Inventory System

ระบบบริหารจัดการร้านกาแฟและการขายหน้าร้าน (Cafe POS) พร้อมระบบตัดสต็อกสินค้าและรายงานสรุปยอดขาย

---

## 🛠️ สิ่งที่ต้องมีในเครื่อง (Prerequisites)

* **Node.js** (เวอร์ชัน 18 ขึ้นไป)
* **MySQL Server** (หรือ **Docker Desktop** สำหรับรัน MySQL + phpMyAdmin ผ่าน Docker Compose)

---

## 🚀 ขั้นตอนการติดตั้งและรันโปรเจกต์

### 1. ติดตั้ง Dependencies
เปิด Terminal ในโฟลเดอร์โปรเจกต์แล้วรัน:
```bash
npm install
```

### 2. ตั้งค่าไฟล์สภาพแวดล้อม (`.env`)
คัดลอกไฟล์ `.env.example` เป็น `.env`:
```bash
cp .env.example .env
```
ตรวจสอบและแก้ไขรหัสผ่าน MySQL ในไฟล์ `.env` ให้ตรงกับเครื่องของคุณ:
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=รหัสผ่าน_MYSQL_ของคุณ
DB_NAME=cafe_pos
PORT=3000
```

### 3. เปิดบริการ MySQL (เลือกวิธีใดวิธีหนึ่ง)

* **วิธีที่ A: ใช้ Docker Compose (สะดวกที่สุด)**
  ```bash
  docker compose up -d
  ```
  *(จะเปิด MySQL บนพอร์ต 3306 และ phpMyAdmin บนพอร์ต 8080: [http://localhost:8080](http://localhost:8080))*

* **วิธีที่ B: ใช้ MySQL ในเครื่อง (XAMPP / MySQL Service)**
  เปิด MySQL Server ตามปกติ

### 4. เตรียมฐานข้อมูลและข้อมูลเริ่มต้น (Database Setup)
รันคำสั่งเพียงคำสั่งเดียวเพื่อสร้างตารางทั้งหมดจาก `schema.sql` และใส่ข้อมูลตัวอย่าง:
```bash
npm run db:setup
```

### 5. สั่งรันแอปพลิเคชัน
```bash
npm run dev
```
เซิร์ฟเวอร์จะเริ่มทำงานที่: **[http://localhost:3000](http://localhost:3000)**

---

## 💻 การใช้งานผ่านหน้าเว็บ (Web UI)

เข้าใช้งานผ่านเบราว์เซอร์: **[http://localhost:3000](http://localhost:3000)** หรือ **[http://localhost:3000/frontend.html](http://localhost:3000/frontend.html)**

ระบบถูกออกแบบเป็น **Single Page Application (SPA)** มี 3 ฟังก์ชันหลักที่ทำงานสอดคล้องกัน:

1. **หน้ารับออเดอร์ (`data-v="order"`):**
   * เลือกเมนูเครื่องดื่ม, เลือกขนาดแก้ว (S/M/L), เลือกระดับความหวาน (0-100%), และเลือกท็อปปิ้ง
   * ค้นหาสมาชิกด้วยเบอร์โทร 10 หลัก เพื่อรับส่วนลด 5%
   * คำนวณ VAT 7% และยอดสุทธิแบบเรียลไทม์
   * ชำระเงิน (เงินสด / QR Code) และตัดสต็อกสินค้าในฐานข้อมูลจริงทันที พร้อมออกใบเสร็จ
2. **หน้าจัดการเมนู (`data-v="menu"`):**
   * แสดงรายการเมนูของสาขาที่เลือก พร้อมป้ายเตือนสต็อกใกล้หมด
   * เพิ่มเมนูใหม่, ค้นหา/กรองตามหมวดหมู่, แก้ไขราคา/สต็อก/หมวดหมู่ และลบเมนู
3. **หน้ารายงานยอดขาย (`data-v="report"`):**
   * กรองดูยอดขายตามช่วงวันที่ และกรองดูเฉพาะสาขา
   * แสดงสรุปยอดขายรวม, จำนวนออเดอร์, รายได้แยกตามสาขา และ 10 อันดับเมนูขายดี

---

## 📡 สรุป REST API Endpoints

### 1. หมวดเมนู (Menu)
| Method | Endpoint | คำอธิบาย |
| :--- | :--- | :--- |
| `GET` | `/api/menu?branchId=1` | ดึงรายการเมนูทั้งหมดของสาขา |
| `GET` | `/api/menu/:id?branchId=1` | ดึงข้อมูลเมนูตาม ID |
| `POST` | `/api/menu` | เพิ่มเมนูใหม่ (`branchId`, `categoryId`, `name`, `price`, `stockQuantity`) |
| `PUT` | `/api/menu/:id` | แก้ไขข้อมูลเมนู (`branchId`, `categoryId`, `name`, `price`, `stockQuantity`) |
| `DELETE` | `/api/menu/:id?branchId=1` | ลบเมนูออกจากสาขา |

### 2. หมวดออเดอร์ (Orders)
| Method | Endpoint | คำอธิบาย |
| :--- | :--- | :--- |
| `POST` | `/api/orders` | บันทึกการสั่งซื้อและตัดสต็อกสินค้าใน MySQL |

**ตัวอย่าง Payload:**
```json
{
  "branchId": 1,
  "employeeId": 1,
  "paymentMethod": "cash",
  "items": [
    { "menuId": 1, "quantity": 2 },
    { "menuId": 2, "quantity": 1 }
  ]
}
```

### 3. หมวดรายงานยอดขาย (Reports)
| Method | Endpoint | คำอธิบาย |
| :--- | :--- | :--- |
| `GET` | `/api/reports/sales?from=2026-10-01&to=2026-10-05&branchId=1&top=all` | ดึงรายงานสรุปยอดขายตามช่วงวันที่และสาขา |

---

## 🗄️ โครงสร้างฐานข้อมูล (Database Schema)
อ้างอิงจาก [`schema.sql`](schema.sql) ซึ่งบังคับชุดอักขระ `utf8mb4` รองรับภาษาไทย 100%:
* `branch`: สาขาของร้าน (สยาม, สีลม)
* `category`: หมวดหมู่เมนู (ชา, กาแฟ, นม/โกโก้, อื่น ๆ)
* `employee`: ข้อมูลพนักงานและตำแหน่ง
* `menu_item`: รายการสินค้า ราคา และจำนวนสต็อกคงเหลือ
* `orders`: ข้อมูลหัวบิลออเดอร์ วันที่เวลา และวิธีชำระเงิน
* `order_item`: รายการสินค้าในแต่ละออเดอร์ จำนวน และราคาต่อหน่วย
* `stock_movement`: ประวัติการเปลี่ยนแปลงสต็อกสินค้า