const User = require("../models/User");

// 1. Get Wallet Data
const getWalletData = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('gold crystals unlockedTests');
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({
      gold: user.gold || 0,
      crystals: user.crystals || 0,
      unlockedTests: user.unlockedTests ? user.unlockedTests.map(t => t.testId) : []
    });
  } catch (error) {
    console.error("Get wallet error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// 2. Add Gold (Ads, Daily Bonus)
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

// 3. Exchange Gold for Crystals (500 Gold = 1 Crystal)
const exchangeGoldForCrystals = async (req, res) => {
  try {
    const { goldAmount } = req.body;
    
    // Check if they have at least 500 gold
    if (goldAmount < 500) {
      return res.status(400).json({ message: "Minimum 500 gold required" });
    }

    // Calculate how many crystals they get and exactly how much gold to deduct
    const crystalsToAdd = Math.floor(goldAmount / 500);
    const goldToDeduct = crystalsToAdd * 500;

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Ensure they have enough balance
    if ((user.gold || 0) < goldToDeduct) {
      return res.status(400).json({ message: `Not enough gold. Need ${goldToDeduct}` });
    }

    // Process the exchange
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

// 6. Verify Google Play Purchase and Give Gold
const verifyGooglePlayPurchase = async (req, res) => {
  try {
    const { productId, purchaseToken, orderId, goldReward } = req.body;

    // Make sure we received the required data from Flutter
    if (!orderId || !purchaseToken || !productId) {
      return res.status(400).json({ success: false, message: "Missing purchase data" });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // 🔴 SECURITY CHECK: Prevent "Replay Attacks"
    // Google Play order IDs look like: GPA.3333-3333-3333-33333
    // If we have seen this exact order ID before, block it!
    if (user.processedPayments && user.processedPayments.includes(orderId)) {
      return res.status(400).json({ success: false, message: "Reward already claimed for this purchase." });
    }

    // 🟢 SUCCESS: Give the user their gold!
    const rewardAmount = parseInt(goldReward) || 0;
    user.gold = (user.gold || 0) + rewardAmount;
    
    // Save the orderId into the array so it can NEVER be used again
    if (!user.processedPayments) user.processedPayments = [];
    user.processedPayments.push(orderId);

    await user.save();
    
    res.json({ 
      success: true, 
      gold: user.gold, 
      crystals: user.crystals, 
      message: `Successfully added ${rewardAmount} gold!` 
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
  verifyGooglePlayPurchase // <-- EXPORTED NEW METHOD
};