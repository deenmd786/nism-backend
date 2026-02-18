const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const {
  getWalletData,
  addGold,
  exchangeGoldForCrystals,
  unlockTest,
  checkTestUnlocked,
  getTransactions
} = require("../controllers/walletController");

// All routes require authentication
router.get("/", auth, getWalletData);
router.post("/gold/add", auth, addGold);
router.post("/exchange", auth, exchangeGoldForCrystals);
router.post("/tests/unlock", auth, unlockTest);
router.get("/tests/:testId/status", auth, checkTestUnlocked);
router.get("/transactions", auth, getTransactions);

module.exports = router;