-- 1. สร้างฐานข้อมูล (ถ้ายังไม่มี)
CREATE DATABASE IF NOT EXISTS cafe_pos 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE cafe_pos;

-- 2. สร้างตาราง orders สำหรับ Sprint 1
CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  payment_method VARCHAR(20) NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);