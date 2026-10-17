// src/setupDb.js
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

async function setupDatabase() {
  console.log("🚀 Initializing Cafe POS Database...");

  const host = process.env.DB_HOST || "localhost";
  const user = process.env.DB_USER || "root";
  const password = process.env.DB_PASSWORD || "test";
  const port = Number(process.env.DB_PORT) || 3306;
  const database = process.env.DB_NAME || "cafe_pos";

  let connection;
  try {
    // 1. Connect without database first to ensure database exists
    connection = await mysql.createConnection({
      host,
      user,
      password,
      port,
      multipleStatements: true,
      charset: "utf8mb4",
    });

    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await connection.query(`USE \`${database}\`;`);
    await connection.query("SET GLOBAL time_zone = '+07:00';").catch(() => {});
    await connection.query("SET time_zone = '+07:00';").catch(() => {});

    // 2. Read and run schema.sql
    const schemaPath = path.join(__dirname, "../schema.sql");
    const schemaSql = fs.readFileSync(schemaPath, "utf8");
    await connection.query(schemaSql);
    console.log("✓ Created tables from schema.sql successfully.");

    // 2.1 Ensure `user` table exists with roles: admin, manager, cashier, barista
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`user\` (
        user_id INT AUTO_INCREMENT PRIMARY KEY,
        branch_id INT NOT NULL,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role ENUM('admin', 'manager', 'cashier', 'barista') NOT NULL DEFAULT 'cashier',
        FOREIGN KEY (branch_id) REFERENCES branch(branch_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Clean up and ensure role column includes barista
    try {
      await connection.query("ALTER TABLE `user` MODIFY COLUMN role ENUM('admin', 'manager', 'cashier', 'barista') NOT NULL DEFAULT 'cashier'");
    } catch (e) {
      // ignore
    }

    // 2.2 Migrate orders table to support user_id and status
    const [orderCols] = await connection.query("SHOW COLUMNS FROM orders");
    const orderColNames = orderCols.map((c) => c.Field);
    if (!orderColNames.includes("user_id")) {
      await connection.query("ALTER TABLE orders ADD COLUMN user_id INT NULL AFTER branch_id");
      if (orderColNames.includes("employee_id")) {
        await connection.query("UPDATE orders SET user_id = employee_id WHERE user_id IS NULL");
      }
      console.log("✓ Added 'user_id' column to orders table.");
    }

    if (!orderColNames.includes("status")) {
      await connection.query("ALTER TABLE orders ADD COLUMN status ENUM('pending', 'preparing', 'ready', 'completed', 'cancelled') NOT NULL DEFAULT 'pending' AFTER payment_method");
      console.log("✓ Added 'status' column to orders table for Barista KDS.");
    }

    // 2.2.1 Migrate order_item table to support notes
    const [orderItemCols] = await connection.query("SHOW COLUMNS FROM order_item");
    const orderItemColNames = orderItemCols.map((c) => c.Field);
    if (!orderItemColNames.includes("notes")) {
      await connection.query("ALTER TABLE order_item ADD COLUMN notes VARCHAR(255) NULL AFTER unit_price");
      console.log("✓ Added 'notes' column to order_item table for drink customization.");
    }

    // Drop legacy foreign key to employee if present
    try {
      await connection.query("ALTER TABLE orders DROP FOREIGN KEY orders_ibfk_2");
      console.log("✓ Dropped legacy employee_id foreign key constraint on orders.");
    } catch (e) {
      // already dropped
    }

    if (orderColNames.includes("employee_id")) {
      await connection.query("ALTER TABLE orders MODIFY employee_id INT NULL");
    }

    // Add foreign key constraint to user(user_id) if not exists
    try {
      await connection.query("ALTER TABLE orders ADD CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES `user`(user_id)");
      console.log("✓ Added foreign key constraint fk_orders_user on orders(user_id).");
    } catch (e) {
      // already exists
    }

    // 2.3 Ensure `member` table exists
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`member\` (
        member_id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        phone CHAR(10) NOT NULL UNIQUE,
        points INT DEFAULT 0,
        discount_rate DECIMAL(5,2) DEFAULT 0.05,
        joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Migrate orders table to support member_id
    const [orderCols2] = await connection.query("SHOW COLUMNS FROM orders");
    const orderColNames2 = orderCols2.map((c) => c.Field);
    if (!orderColNames2.includes("member_id")) {
      await connection.query("ALTER TABLE orders ADD COLUMN member_id INT NULL AFTER user_id");
      console.log("✓ Added 'member_id' column to orders table.");
    }

    try {
      await connection.query("ALTER TABLE orders ADD CONSTRAINT fk_orders_member FOREIGN KEY (member_id) REFERENCES `member`(member_id)");
      console.log("✓ Added foreign key constraint fk_orders_member on orders(member_id).");
    } catch (e) {
      // already exists
    }

    // Ensure branch_id of menu 1 is 1
    await connection.query("UPDATE menu_item SET branch_id = 1 WHERE menu_id = 1");

    // 3. Insert Initial Seed Data
    const seedSql = `
      INSERT INTO branch (branch_id, name, address) VALUES 
      (1, 'สยาม', 'BTS สยาม'),
      (2, 'สีลม', 'BTS ศาลาแดง')
      ON DUPLICATE KEY UPDATE name=VALUES(name), address=VALUES(address);

      INSERT INTO category (category_id, name) VALUES 
      (1, 'ชา'), (2, 'กาแฟ'), (3, 'นม/โกโก้'), (4, 'อื่น ๆ')
      ON DUPLICATE KEY UPDATE name=VALUES(name);

      INSERT INTO \`user\` (user_id, branch_id, name, email, password, role) VALUES 
      (1, 1, 'สมชาย แคชเชียร์สยาม', 'cashier@cafe.com', 'password123', 'cashier'),
      (2, 1, 'สมศรี ผู้จัดการร้าน Whatever Cafe', 'manager@cafe.com', 'password123', 'manager'),
      (3, 1, 'ผู้ดูแลระบบ Whatever Cafe (HQ)', 'admin@cafe.com', 'password123', 'admin'),
      (4, 2, 'สมศักดิ์ แคชเชียร์สีลม', 'cashier2@cafe.com', 'password123', 'cashier'),
      (5, 1, 'บอย บาริสต้าสยาม', 'barista@cafe.com', 'password123', 'barista'),
      (6, 2, 'เบนซ์ บาริสต้าสีลม', 'barista2@cafe.com', 'password123', 'barista')
      ON DUPLICATE KEY UPDATE 
        branch_id=VALUES(branch_id),
        name=VALUES(name),
        email=VALUES(email),
        password=VALUES(password),
        role=VALUES(role);

      INSERT INTO menu_item (menu_id, branch_id, category_id, name, price, stock_quantity) VALUES 
      (1, 1, 2, 'เอสเปรสโซ่เย็น', 55.00, 20),
      (2, 1, 1, 'ชาเขียวเย็น', 50.00, 15),
      (3, 1, 2, 'อเมริกาโน่ร้อน', 45.00, 8),
      (4, 1, 2, 'ลาเต้', 55.00, 12),
      (5, 1, 2, 'คาปูชิโน่', 55.00, 10),
      (6, 1, 1, 'ชาไทย', 50.00, 18),
      (7, 2, 2, 'เอสเปรสโซ่เย็น (สีลม)', 55.00, 25),
      (8, 2, 1, 'ชาไทย (สีลม)', 50.00, 20)
      ON DUPLICATE KEY UPDATE name=VALUES(name), price=VALUES(price);

      INSERT INTO \`member\` (member_id, name, phone, points, discount_rate) VALUES 
      (1, 'คุณสมหญิง จริงใจ (Cafe Club VIP)', '0812345678', 150, 0.05),
      (2, 'คุณวรวิทย์ ยอดรัก (Cafe Club Gold)', '0898765432', 80, 0.05),
      (3, 'คุณณภัทร วงศ์ดี (Cafe Club Member)', '0861112222', 25, 0.05),
      (4, 'คุณทดสอบ สมาชิก (Cafe Club)', '0811111111', 50, 0.05)
      ON DUPLICATE KEY UPDATE 
        name=VALUES(name),
        phone=VALUES(phone),
        points=VALUES(points),
        discount_rate=VALUES(discount_rate);
    `;
    await connection.query(seedSql);
    console.log("✓ Seed data inserted successfully.");

    console.log("\n🎉 Database setup completed successfully!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Database setup failed:", err.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

setupDatabase();
