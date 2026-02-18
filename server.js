const express = require("express");
const router = express.Router();

const {
  registerUser,
  loginUser,
  googleLogin
} = require("../controllers/authController");

const auth = require("../middleware/authMiddleware");
const User = require("../models/User");

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/google", googleLogin);

// 🔹 Get current user
router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
