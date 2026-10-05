-- กำหนดชุดอักขระให้รองรับภาษาไทย (UTF-8) เสมอ
SET NAMES 'utf8mb4';
SET CHARACTER SET utf8mb4;

-- 1. สร้างตารางหมวดหมู่สินค้า
CREATE TABLE IF NOT EXISTS category (
  category_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. สร้างตารางสาขา
CREATE TABLE IF NOT EXISTS branch (
  branch_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  address VARCHAR(255)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. สร้างตารางพนักงาน
CREATE TABLE IF NOT EXISTS employee (
  employee_id INT AUTO_INCREMENT PRIMARY KEY,
  branch_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL,
  FOREIGN KEY (branch_id) REFERENCES branch(branch_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. สร้างตารางเมนูและสต็อก
CREATE TABLE IF NOT EXISTS menu_item (
  menu_id INT AUTO_INCREMENT PRIMARY KEY,
  branch_id INT NOT NULL,
  category_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  stock_quantity INT DEFAULT 0,
  FOREIGN KEY (branch_id) REFERENCES branch(branch_id),
  FOREIGN KEY (category_id) REFERENCES category(category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. สร้างตารางออเดอร์ (หัวบิล)
CREATE TABLE IF NOT EXISTS orders (
  order_id INT AUTO_INCREMENT PRIMARY KEY,
  branch_id INT NOT NULL,
  employee_id INT NOT NULL,
  payment_method VARCHAR(20) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES branch(branch_id),
  FOREIGN KEY (employee_id) REFERENCES employee(employee_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. สร้างตารางรายการสินค้าในออเดอร์
CREATE TABLE IF NOT EXISTS order_item (
  order_item_id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  menu_id INT NOT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(order_id),
  FOREIGN KEY (menu_id) REFERENCES menu_item(menu_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. สร้างตารางบันทึกความเคลื่อนไหวของสต็อก
CREATE TABLE IF NOT EXISTS stock_movement (
  movement_id INT AUTO_INCREMENT PRIMARY KEY,
  menu_id INT NOT NULL,
  quantity_change INT NOT NULL,
  moved_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (menu_id) REFERENCES menu_item(menu_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
