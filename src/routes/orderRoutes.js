const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");

const { requireAuth, requireRole } = require("../middleware/authMiddleware");

// สร้างออเดอร์: แคชเชียร์ (ล็อกสาขาตามบัญชี) หรือ manager/admin
router.post("/", requireRole(["cashier", "manager", "admin"]), orderController.createOrder);

// รายการออเดอร์ทุกสาขา: เฉพาะ manager/admin
router.get("/", requireRole(["manager", "admin"]), orderController.getAllOrders);

// Barista KDS Queue and Status Endpoints
router.get("/queue", requireAuth, orderController.getBaristaQueue);
router.get("/pending", requireAuth, orderController.getBaristaQueue);
router.patch(
  "/:id/status",
  requireRole(["barista", "manager", "admin"]),
  orderController.updateOrderStatus,
);

module.exports = router;
