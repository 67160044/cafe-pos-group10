const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");

const { authenticate } = require("../middleware/authMiddleware");

router.post("/", authenticate, orderController.createOrder);
router.get("/", authenticate, orderController.getAllOrders);

// Barista KDS Queue and Status Endpoints
router.get("/queue", authenticate, orderController.getBaristaQueue);
router.get("/pending", authenticate, orderController.getBaristaQueue);
router.patch("/:id/status", authenticate, orderController.updateOrderStatus);
router.put("/:id/status", authenticate, orderController.updateOrderStatus);

module.exports = router;
