const express = require("express");
const router = express.Router();

const auth = require("../middleware/authMiddleware");

// Import your controller functions
const {
  getWalletData,
  addGold,
  exchangeGoldForCrystals,
  unlockTest,
  checkTestUnlocked,
  verifyGooglePlayPurchase // <-- NEW GOOGLE PLAY METHOD
} = require("../controllers/walletController");

console.log("✅ Wallet Routes loaded successfully");

// Existing Routes
router.get("/", auth, getWalletData);
router.post("/gold/add", auth, addGold);
router.post("/exchange", auth, exchangeGoldForCrystals);
router.post("/tests/unlock", auth, unlockTest);
router.get("/tests/:testId/status", auth, checkTestUnlocked);

// --- NEW GOOGLE PLAY ROUTE ---
router.post("/google-play/verify", auth, verifyGooglePlayPurchase);

module.exports = router;