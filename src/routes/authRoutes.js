// src/routes/authRoutes.js
const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { requireAuth } = require("../middleware/authMiddleware");

router.post("/login", authController.login);
router.get("/me", requireAuth, authController.getMe);
router.get("/users", authController.listUsers);
router.get("/employees", authController.listUsers);

module.exports = router;
