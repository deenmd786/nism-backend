const express = require("express");
const router = express.Router();

// --- 1. Robust Auth Import ---
// Import the raw middleware object/function
const authMiddleware = require("../middleware/authMiddleware");

// Check if it was exported as "module.exports = func" OR "exports.auth = func"
// This fixes the "handler must be a function" error regardless of export style
const auth = typeof authMiddleware === 'function' 
  ? authMiddleware 
  : authMiddleware.auth;

// --- 2. Robust Controller Import ---
const controller = require("../controllers/walletController");
const {
  getWalletData,
  addGold,
  exchangeGoldForCrystals,
  unlockTest,
  checkTestUnlocked,
  getTransactions
} = controller;

// --- 3. Safety Check (Logs to Vercel Console if something is wrong) ---
if (typeof auth !== 'function') {
  console.error("❌ CRITICAL ERROR: 'auth' middleware is missing or not a function. Received:", typeof auth);
  // Fallback to prevent crash (optional, but good for debugging)
  throw new Error("Auth middleware is not a function");
}

if (typeof getWalletData !== 'function') {
  console.error("❌ CRITICAL ERROR: 'getWalletData' is missing. Check walletController.js exports.");
  throw new Error("Controller function is missing");
}

// --- 4. Define Routes ---
console.log("✅ Wallet Routes loaded successfully");

router.get("/", auth, getWalletData);
router.post("/gold/add", auth, addGold);
router.post("/exchange", auth, exchangeGoldForCrystals);
router.post("/tests/unlock", auth, unlockTest);
router.get("/tests/:testId/status", auth, checkTestUnlocked);
router.get("/transactions", auth, getTransactions);

module.exports = router;