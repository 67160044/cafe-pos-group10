require("dotenv").config();
const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  port: Number(process.env.DB_PORT) || 3306,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "cafe_pos",
  waitForConnections: true,
  connectionLimit: 10,
  charset: "utf8mb4",
  timezone: "+07:00",
});

// กำหนด Timezone เป็นเวลาประเทศไทย (UTC+7 / Asia/Bangkok) ทุก Connection
pool.pool.on("connection", (connection) => {
  connection.query("SET time_zone = '+07:00'");
});

module.exports = pool;
