const express = require("express");
const router = express.Router();

// Clean auth import
const auth = require("../middleware/authMiddleware");

// Import your controller functions (removed getTransactions, added Razorpay)
const {
  getWalletData,
  addGold,
  exchangeGoldForCrystals,
  unlockTest,
  checkTestUnlocked,
  createRazorpayOrder,    // <-- ADDED FOR RAZORPAY
  verifyRazorpayPayment   // <-- ADDED FOR RAZORPAY
} = require("../controllers/walletController");

console.log("✅ Wallet Routes loaded successfully");

// Existing Routes
router.get("/", auth, getWalletData);
router.post("/gold/add", auth, addGold);
router.post("/exchange", auth, exchangeGoldForCrystals);
router.post("/tests/unlock", auth, unlockTest);
router.get("/tests/:testId/status", auth, checkTestUnlocked);

// --- NEW RAZORPAY ROUTES ---
router.post("/razorpay/create-order", auth, createRazorpayOrder);
router.post("/razorpay/verify-payment", auth, verifyRazorpayPayment);

module.exports = router;