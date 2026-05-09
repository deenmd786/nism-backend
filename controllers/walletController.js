const User = require("../models/User");
const { google } = require('googleapis');

// Google Play Auth Setup
const auth = new google.auth.GoogleAuth({
  keyFile: './service-account.json', 
  scopes: ['https://www.googleapis.com/auth/androidpublisher']
});
const androidPublisher = google.androidpublisher({ version: 'v3', auth });

// 1. Get Wallet Data (Added referral code and daily bonus info)
const getWalletData = async (req, res) => {
  try {
const user = await User.findById(req.user.id).select('gold crystals unlockedTests referralCode hasClaimedReferral');

    if (!user) return res.status(404).json({ message: "User not found" });

    // Generate a referral code if the user doesn't have one yet
    if (!user.referralCode) {
      user.referralCode = "NISM" + user._id.toString().substring(0, 6).toUpperCase();
      await user.save();
    }

    res.json({
      gold: user.gold || 0,
      crystals: user.crystals || 0,
      unlockedTests: user.unlockedTests ? user.unlockedTests.map(t => t.testId) : [],
      referralCode: user.referralCode,
      hasClaimedReferral: user.hasClaimedReferral || false
    });
  } catch (error) {
    console.error("Get wallet error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// 2. Add Gold (Ads only now - Daily Bonus has its own secure route)
const addGold = async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ message: "Invalid amount" });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.gold = (user.gold || 0) + amount;
    await user.save();
    
    res.json({ success: true, gold: user.gold, crystals: user.crystals, message: `Added ${amount} gold` });
  } catch (error) {
    console.error("Add gold error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ==========================================
// 🛡️ NEW: SECURE DAILY BONUS LOGIC
// ==========================================

// Check if Daily Bonus is available
const getDailyBonusStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const lastClaim = user.lastDailyClaim;
    let isAvailable = true;
    let nextAvailableTime = null;

    if (lastClaim) {
      const diffMs = new Date() - lastClaim;
      if (diffMs < 24 * 60 * 60 * 1000) { // Less than 24 hours ago
        isAvailable = false;
        nextAvailableTime = new Date(lastClaim.getTime() + 24 * 60 * 60 * 1000);
      }
    }

    res.json({ isAvailable, nextAvailableTime });
  } catch (error) {
    console.error("Status error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Actually Claim the Daily Bonus
const claimDailyBonus = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const now = new Date();
    const lastClaim = user.lastDailyClaim;

    // Check on the SERVER side if 24 hours have passed
    if (lastClaim) {
      const diffMs = now - lastClaim;
      if (diffMs < 24 * 60 * 60 * 1000) {
        return res.status(400).json({ 
          success: false, 
          message: "Daily bonus not ready yet" 
        });
      }
    }

    // Give reward and update the server timestamp
    user.gold = (user.gold || 0) + 50;
    user.lastDailyClaim = now;
    await user.save();

    res.json({ success: true, gold: user.gold, message: "Claimed 50 gold" });
  } catch (error) {
    console.error("Claim bonus error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ==========================================
// EXISTING LOGIC (Exchanges & Tests)
// ==========================================

// 3. Exchange Gold for Crystals (500 Gold = 1 Crystal)
const exchangeGoldForCrystals = async (req, res) => {
  try {
    const { goldAmount } = req.body;
    if (goldAmount < 500) return res.status(400).json({ message: "Minimum 500 gold required" });

    const crystalsToAdd = Math.floor(goldAmount / 500);
    const goldToDeduct = crystalsToAdd * 500;

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if ((user.gold || 0) < goldToDeduct) {
      return res.status(400).json({ message: `Not enough gold. Need ${goldToDeduct}` });
    }

    user.gold -= goldToDeduct;
    user.crystals = (user.crystals || 0) + crystalsToAdd;
    await user.save();
    
    res.json({ success: true, gold: user.gold, crystals: user.crystals, message: "Exchange successful" });
  } catch (error) {
    console.error("Exchange error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// 4. Unlock Test
const unlockTest = async (req, res) => {
  try {
    const { testId } = req.body;
    const cost = 5;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.unlockedTests && user.unlockedTests.some(t => t.testId === testId)) {
      return res.json({ success: true, alreadyUnlocked: true, message: "Test already unlocked" });
    }

    if ((user.crystals || 0) < cost) {
      return res.status(400).json({ message: `Not enough crystals. Need ${cost}` });
    }

    user.crystals -= cost;
    user.unlockedTests.push({ testId });
    await user.save();
    
    res.json({ success: true, crystals: user.crystals, unlockedTests: user.unlockedTests.map(t => t.testId), message: "Unlocked successfully" });
  } catch (error) {
    console.error("Unlock test error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// 5. Check Test Unlocked
const checkTestUnlocked = async (req, res) => {
  try {
    const { testId } = req.params;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const isUnlocked = user.unlockedTests ? user.unlockedTests.some(t => t.testId === testId) : false;
    res.json({ unlocked: isUnlocked, crystals: user.crystals || 0, gold: user.gold || 0 });
  } catch (error) {
    console.error("Check test error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// --- NEW GOOGLE PLAY VERIFICATION ---
const verifyGooglePlayPurchase = async (req, res) => {
  try {
    const { productId, purchaseToken, orderId, crystalReward } = req.body;

    // Make sure we received the required data from Flutter
    if (!orderId || !purchaseToken || !productId) {
      return res.status(400).json({ success: false, message: "Missing purchase data" });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // 🔴 SECURITY CHECK 1: Prevent "Replay Attacks" locally
    // If we have seen this exact order ID before, block it!
   if (user.processedPayments && user.processedPayments.includes(purchaseToken)) {
      return res.status(400).json({ success: false, message: "Reward already claimed for this purchase." });
    }

    // 🔴 SECURITY CHECK 2: Ask Google if the purchase is actually real!
    let purchaseReceipt;
    try {
      const response = await androidPublisher.purchases.products.get({
        packageName: 'com.digroz.learning',
        productId: productId,
        token: purchaseToken
      });
      purchaseReceipt = response.data;
    } catch (googleError) {
      console.error("Failed to verify token with Google:", googleError.message);
      return res.status(400).json({ success: false, message: "Invalid purchase token from Google." });
    }

    // purchaseState 0 means "Purchased". 1 means "Canceled". 2 means "Pending".
    if (purchaseReceipt.purchaseState !== 0) {
      return res.status(400).json({ success: false, message: "Purchase is not in a completed state." });
    }

    // 🟢 SUCCESS: Google confirmed it is real! Give the user their crystals.
    const rewardAmount = parseInt(crystalReward) || 0;
    user.crystals = (user.crystals || 0) + rewardAmount;
    
    // Save the orderId into the array so it can NEVER be used again
    if (!user.processedPayments) user.processedPayments = [];
    user.processedPayments.push(purchaseToken);

    await user.save();
    
    res.json({ 
      success: true, 
      gold: user.gold, 
      crystals: user.crystals, 
      message: `Payment Verified! Successfully added ${rewardAmount} crystals!` 
    });

  } catch (error) {
    console.error("Verify Google Play payment error:", error);
    res.status(500).json({ message: "Server error verifying payment" });
  }
};

// ==========================================
// 🛡️ NEW: REFERRAL SYSTEM LOGIC
// ==========================================

const claimReferralCode = async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ message: "Referral code is required" });

    const currentUser = await User.findById(req.user.id);
    if (!currentUser) return res.status(404).json({ message: "User not found" });

    // 1. Check if they already claimed a code
    if (currentUser.hasClaimedReferral) {
      return res.status(400).json({ success: false, message: "You have already claimed a referral code." });
    }

    // 2. Prevent using their own code
    if (currentUser.referralCode === code) {
      return res.status(400).json({ success: false, message: "You cannot use your own referral code." });
    }

    // 3. Find the referrer
    const referrer = await User.findOne({ referralCode: code });
    if (!referrer) {
      return res.status(404).json({ success: false, message: "Invalid referral code." });
    }

    // 4. Reward the Current User (Referee) - 100 Gold
    currentUser.gold = (currentUser.gold || 0) + 100;
    currentUser.hasClaimedReferral = true;
    currentUser.referredBy = referrer._id.toString();

    // 5. Reward the Referrer - 200 Gold
    referrer.gold = (referrer.gold || 0) + 200;

    // Save both users
    await Promise.all([currentUser.save(), referrer.save()]);

    res.json({ 
      success: true, 
      gold: currentUser.gold, 
      message: "Referral claimed! You received 100 Gold." 
    });

  } catch (error) {
    console.error("Claim referral error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// EXPORT ALL
module.exports = {
  getWalletData,
  addGold,
  exchangeGoldForCrystals,
  unlockTest,
  checkTestUnlocked,
  verifyGooglePlayPurchase,
  getDailyBonusStatus, 
  claimDailyBonus,
  claimReferralCode      
};