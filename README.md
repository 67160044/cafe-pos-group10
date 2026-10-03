# 🚀 ขั้นตอนการติดตั้งและรันโปรเจกต์ Cafe POS (สำหรับสมาชิกในกลุ่ม)

คู่มือสำหรับสมาชิกในกลุ่มที่ Clone โปรเจกต์นี้ไปรันต่อที่เครื่องตัวเอง และทดสอบ API ผ่าน Postman

---

## 🛠️ สิ่งที่ต้องมีในเครื่อง (Prerequisites)

* **Node.js** (เวอร์ชัน 18 ขึ้นไป)
* **Docker Desktop** (ใช้รัน MySQL + phpMyAdmin ผ่าน `docker-compose.yml` ไม่ต้องติดตั้ง MySQL ลงเครื่องโดยตรง)
* **Postman** (หรือเครื่องมือยิง API อื่นๆ)

---

## 📦 1. ติดตั้ง Package

หลัง Clone Repository แล้ว เปิด Terminal ในโฟลเดอร์โปรเจกต์ (`cafe-pos-group10-main`) แล้วรัน:

```bash
npm install
```

---

## ⚙️ 2. ตั้งค่าไฟล์ `.env`

ไฟล์ `.env` ไม่ได้ push ขึ้น GitHub (อยู่ใน `.gitignore`) ให้สร้างไฟล์ชื่อ `.env` เองที่ root ของโปรเจกต์ (โฟลเดอร์เดียวกับ `package.json`) แล้วใส่ค่านี้ (ตั้งรหัสผ่านเองได้ตามใจ แต่ต้องให้ค่าตรงกันทุกจุดที่ซ้ำกัน):

```env
MYSQL_ROOT_PASSWORD=1234
MYSQL_DATABASE=cafe_pos
MYSQL_USER=myuser
MYSQL_PASSWORD=1234

MYSQL_PORT=3306
PMA_PORT=8080

DB_HOST=localhost
DB_USER=root
DB_PASSWORD=1234
DB_NAME=cafe_pos
PORT=3000
```

---

## 🐳 3. รัน MySQL ผ่าน Docker

```bash
docker-compose up -d
```

เช็คว่า container รันสำเร็จ:

```bash
docker ps
```

ควรเห็น `mysql_pos_db` (Healthy) และ `pos_phpmyadmin` (Up)

**ปัญหาที่เจอบ่อย:** ถ้า error ว่าชื่อ container ซ้ำ (`Conflict. The container name ... is already in use`) ให้ลบ container เก่าทิ้งก่อน:
```bash
docker rm -f mysql_pos_db pos_phpmyadmin
docker-compose up -d
```

---

## 🗄️ 4. สร้างตารางและข้อมูลตั้งต้น

เปิด **MySQL Workbench** (เชื่อมต่อ `127.0.0.1:3306`, user `root`, password ตรงกับ `MYSQL_ROOT_PASSWORD` ใน `.env`) หรือเปิด **phpMyAdmin** ที่ `http://localhost:8080` แล้ว:

1. วางโค้ดจากไฟล์ `schema.sql` (อยู่ที่ root ของโปรเจกต์) รันให้ครบ (สร้าง 7 ตาราง: category, branch, employee, menu_item, orders, order_item, stock_movement)
2. รัน seed data ด้านล่างเพื่อให้มีข้อมูลตั้งต้นทดสอบได้ทันที:

```sql
USE cafe_pos;

INSERT INTO branch (name, address) VALUES
  ('สาขาเซ็นทรัล', '123 ถ.สุขุมวิท กรุงเทพฯ'),
  ('สาขาเมญ่า', '99 ถ.นิมมานเหมินท์ เชียงใหม่');

INSERT INTO employee (branch_id, name, role) VALUES
  (1, 'สมชาย ใจดี', 'cashier'),
  (1, 'สมหญิง รักงาน', 'barista'),
  (2, 'วิชัย มั่นคง', 'cashier');

INSERT INTO category (name) VALUES
  ('กาแฟ'), ('ชา'), ('เบเกอรี่');

INSERT INTO menu_item (branch_id, category_id, name, price, stock_quantity) VALUES
  (1, 1, 'อเมริกาโน่', 45.00, 50),
  (1, 1, 'ลาเต้', 55.00, 50),
  (1, 2, 'ชาเขียว', 50.00, 30),
  (1, 3, 'ครัวซองต์', 65.00, 20),
  (2, 1, 'อเมริกาโน่', 45.00, 40),
  (2, 1, 'ลาเต้', 55.00, 40);
```

---

## ▶️ 5. สั่งรัน Server

```bash
npm run dev
```

สำเร็จแล้วจะเห็น:

```
Cafe POS server running on port 3000
```

(`npm run dev` ใช้ `--watch` รีสตาร์ท server อัตโนมัติทุกครั้งที่แก้โค้ดแล้วเซฟ)

---

## 🧪 6. ทดสอบ API ผ่าน Postman

### สั่งซื้อ

**POST** `http://localhost:3000/api/orders`
```json
{
  "branchId": 1,
  "employeeId": 1,
  "paymentMethod": "cash",
  "items": [
    { "menuId": 1, "quantity": 2 }
  ]
}
```
สำเร็จ → `201 Created` พร้อม `orderId`, `lowStockMenuIds`
**หมายเหตุ:** ไม่ต้องส่ง `name`/`price` มาด้วย — ระบบดึงราคาจาก `menu_item.price` ในฐานข้อมูลเสมอ (ป้องกันแก้ไขราคาจาก client)

**GET** `http://localhost:3000/api/orders` — ดูรายการออเดอร์ทั้งหมด

### จัดการเมนู

| สิ่งที่ทำ | Method | URL | Body |
|---|---|---|---|
| ดูรายการเมนูของสาขา | GET | `/api/menu?branchId=1` | — |
| ดูเมนูรายตัว | GET | `/api/menu/1?branchId=1` | — |
| เพิ่มเมนูใหม่ | POST | `/api/menu` | `{"branchId":1,"categoryId":1,"name":"มอคค่า","price":60,"stockQuantity":20}` |
| แก้ไขเมนู (ส่งแค่ field ที่แก้ก็ได้) | PUT | `/api/menu/1` | `{"branchId":1,"price":50}` |
| ลบเมนู | DELETE | `/api/menu/1?branchId=1` | — |

**ข้อควรระวัง:** ทุก endpoint ของเมนูต้องมี `branchId` เสมอ (ป้องกันแก้ไข/ลบเมนูของสาขาอื่น)

### กรณี error ที่ควรลองด้วย

- สั่งเกินสต็อกที่มี → `400 Bad Request` ("สต็อกไม่เพียงพอสำหรับเมนู id ...")
- ไม่ระบุ `branchId`/`employeeId`/`paymentMethod` → `400 Bad Request`
- สั่งเมนูเดียวกัน 2 บรรทัดในออเดอร์เดียว → ระบบรวมจำนวนก่อนตัดสต็อก (ไม่ตัดแยกทีละบรรทัด)
