const User = require("../models/User");

// 1. Get Wallet Data (Added referral code and daily bonus info)
const getWalletData = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('gold crystals unlockedTests referralCode');
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
      referralCode: user.referralCode
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

// 6. Verify Google Play Purchase
const verifyGooglePlayPurchase = async (req, res) => {
  try {
    const { productId, purchaseToken, orderId, crystalReward } = req.body; // Changed from goldReward to crystalReward

    if (!orderId || !purchaseToken || !productId) {
      return res.status(400).json({ success: false, message: "Missing purchase data" });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.processedPayments && user.processedPayments.includes(orderId)) {
      return res.status(400).json({ success: false, message: "Reward already claimed for this purchase." });
    }

    // Give Crystals, not Gold!
    const rewardAmount = parseInt(crystalReward) || 0;
    user.crystals = (user.crystals || 0) + rewardAmount;
    
    if (!user.processedPayments) user.processedPayments = [];
    user.processedPayments.push(orderId);

    await user.save();
    
    res.json({ 
      success: true, 
      gold: user.gold, 
      crystals: user.crystals, 
      message: `Successfully added ${rewardAmount} crystals!` 
    });

  } catch (error) {
    console.error("Verify Google Play payment error:", error);
    res.status(500).json({ message: "Server error verifying payment" });
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
  getDailyBonusStatus, // NEW
  claimDailyBonus      // NEW
};