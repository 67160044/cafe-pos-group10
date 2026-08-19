const db = require("../config/db");
const VALID_PAYMENT_METHODS = ["cash", "credit", "qr"];

exports.createOrder = async (req, res) => {
  const { items, paymentMethod } = req.body;

  // 1. Validate items (Exception 1a - US-03)
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "ต้องมีรายการสินค้าอย่างน้อย 1 รายการ" });
  }

  // 2. Validate name (Exception 1b - US-03)
  const hasInvalidName = items.some(
    (item) => typeof item.name !== "string" || item.name.trim() === ""
  );
  if (hasInvalidName) {
    return res.status(400).json({ error: "ต้องระบุชื่อสินค้าให้ครบทุกรายการ" });
  }

  // 3. Validate price (Exception 1c - US-03)
  const hasInvalidPrice = items.some(
    (item) => !Number.isFinite(item.price) || item.price <= 0
  );
  if (hasInvalidPrice) {
    return res.status(400).json({ error: "price ต้องมากกว่า 0" });
  }

  // 4. Validate quantity (Exception 1d - US-03)
  const hasInvalidQuantity = items.some(
    (item) => !Number.isInteger(item.quantity) || item.quantity <= 0
  );
  if (hasInvalidQuantity) {
    return res.status(400).json({ error: "quantity ต้องมากกว่า 0" });
  }

  // 5. Validate paymentMethod (Exception 2a - US-02)
  if (!VALID_PAYMENT_METHODS.includes(paymentMethod)) {
    return res.status(400).json({ error: "paymentMethod ไม่ถูกต้องหรือไม่ได้ระบุ" });
  }

  // คำนวณ totalAmount ฝั่ง Backend เสมอ (US-01)
  const totalAmount = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  try {
    const [result] = await db.query(
      "INSERT INTO orders (payment_method, total_amount, created_at) VALUES (?, ?, NOW())",
      [paymentMethod, totalAmount]
    );

    res.status(201).json({ orderId: result.insertId, totalAmount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการบันทึกออเดอร์" });
  }
};

exports.getAllOrders = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM orders");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลออเดอร์" });
  }
};