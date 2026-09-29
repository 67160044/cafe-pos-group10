// src/routes/menuRoutes.js
const express = require("express");
const router = express.Router();
const menuController = require("../controllers/menuController");

router.get("/", menuController.listMenu);
router.get("/:id", menuController.getMenuById);
router.post("/", menuController.createMenu);
router.put("/:id", menuController.updateMenu);
router.delete("/:id", menuController.deleteMenu);

module.exports = router;
// ผูกใน app.js ด้วย app.use('/api/menu', require('./routes/menuRoutes'))
// ตามรูปแบบเดียวกับที่ orderRoutes.js ผูกไว้ใน Sprint 1 (wk05.md)
