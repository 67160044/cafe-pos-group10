// src/routes/authRoutes.js
const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { requireAuth, requireRole } = require("../middleware/authMiddleware");

router.post("/login", authController.login);
router.get("/me", requireAuth, authController.getMe);
router.get("/users", requireRole(["admin"]), authController.listUsers);
router.get("/employees", requireRole(["admin"]), authController.listUsers);

module.exports = router;
