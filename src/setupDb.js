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

    // 2. Read and run schema.sql
    const schemaPath = path.join(__dirname, "../schema.sql");
    const schemaSql = fs.readFileSync(schemaPath, "utf8");
    await connection.query(schemaSql);
    console.log("✓ Created tables from schema.sql successfully.");

    // 3. Insert Initial Seed Data
    const seedSql = `
      INSERT INTO branch (branch_id, name, address) VALUES 
      (1, 'สยาม', 'BTS สยาม'),
      (2, 'สีลม', 'BTS ศาลาแดง')
      ON DUPLICATE KEY UPDATE name=VALUES(name), address=VALUES(address);

      INSERT INTO category (category_id, name) VALUES 
      (1, 'ชา'), (2, 'กาแฟ'), (3, 'นม/โกโก้'), (4, 'อื่น ๆ')
      ON DUPLICATE KEY UPDATE name=VALUES(name);

      INSERT INTO employee (employee_id, branch_id, name, role) VALUES 
      (1, 1, 'สมชาย พนักงานขาย', 'cashier')
      ON DUPLICATE KEY UPDATE name=VALUES(name), role=VALUES(role);

      INSERT INTO menu_item (menu_id, branch_id, category_id, name, price, stock_quantity) VALUES 
      (1, 1, 2, 'เอสเปรสโซ่เย็น', 55.00, 20),
      (2, 1, 1, 'ชาเขียวเย็น', 50.00, 15),
      (3, 1, 2, 'อเมริกาโน่ร้อน', 45.00, 8),
      (4, 1, 2, 'ลาเต้', 55.00, 12),
      (5, 1, 2, 'คาปูชิโน่', 55.00, 10),
      (6, 1, 1, 'ชาไทย', 50.00, 18)
      ON DUPLICATE KEY UPDATE name=VALUES(name), price=VALUES(price);
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
