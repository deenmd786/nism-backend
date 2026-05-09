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
  verifyGooglePlayPurchase,
  getDailyBonusStatus, // <-- IMPORTED NEW METHOD
  claimDailyBonus,      // <-- IMPORTED NEW METHOD
  claimReferralCode
} = require("../controllers/walletController");

console.log("✅ Wallet Routes loaded successfully");

// Existing Routes
router.get("/", auth, getWalletData);
router.post("/gold/add", auth, addGold);
router.post("/exchange", auth, exchangeGoldForCrystals);
router.post("/tests/unlock", auth, unlockTest);
router.get("/tests/:testId/status", auth, checkTestUnlocked);

// Google Play Route
router.post("/google-play/verify", auth, verifyGooglePlayPurchase);

// --- NEW SECURE DAILY BONUS ROUTES ---
// Make sure these match the URLs requested in your Flutter WalletService
router.get("/daily-bonus/status", auth, getDailyBonusStatus);
router.post("/daily-bonus/claim", auth, claimDailyBonus);
router.post('/claim-referral', verifyToken, claimReferralCode);

module.exports = router;