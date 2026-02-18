const User = require("../models/User");

// @desc    Get user's wallet data
// @route   GET /api/wallet
exports.getWalletData = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('gold crystals unlockedTests transactions');
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Get last 10 transactions
    const recentTransactions = user.transactions.slice(-10).reverse();

    res.json({
      gold: user.gold || 0,
      crystals: user.crystals || 0,
      unlockedTests: user.unlockedTests.map(t => t.testId) || [],
      transactions: recentTransactions
    });
  } catch (error) {
    console.error("Get wallet error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Add gold (earned from practice quizzes)
// @route   POST /api/wallet/gold/add
exports.addGold = async (req, res) => {
  try {
    const { amount } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Invalid amount" });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Add gold
    user.gold += amount;
    
    // Add transaction record
    user.transactions.push({
      type: 'earn_gold',
      goldChange: amount,
      description: `Earned ${amount} gold from practice quiz`
    });

    await user.save();

    res.json({ 
      success: true, 
      gold: user.gold,
      crystals: user.crystals,
      message: `Added ${amount} gold successfully` 
    });
  } catch (error) {
    console.error("Add gold error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Exchange gold for crystals
// @route   POST /api/wallet/exchange
exports.exchangeGoldForCrystals = async (req, res) => {
  try {
    const { goldAmount } = req.body;
    
    // Calculate crystals (100 gold = 1 crystal)
    if (goldAmount < 100) {
      return res.status(400).json({ message: "Minimum 100 gold required for exchange" });
    }

    const crystalsToAdd = Math.floor(goldAmount / 100);
    const goldToDeduct = crystalsToAdd * 100; // Deduct only in multiples of 100

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.gold < goldToDeduct) {
      return res.status(400).json({ 
        message: `Not enough gold. You need ${goldToDeduct} gold for ${crystalsToAdd} crystals` 
      });
    }

    // Perform exchange
    user.gold -= goldToDeduct;
    user.crystals += crystalsToAdd;
    
    // Add transaction record
    user.transactions.push({
      type: 'exchange',
      goldChange: -goldToDeduct,
      crystalsChange: crystalsToAdd,
      description: `Exchanged ${goldToDeduct} gold for ${crystalsToAdd} crystals`
    });

    await user.save();

    res.json({ 
      success: true, 
      gold: user.gold,
      crystals: user.crystals,
      message: `Exchanged ${goldToDeduct} gold for ${crystalsToAdd} crystals` 
    });
  } catch (error) {
    console.error("Exchange error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Unlock test with crystals
// @route   POST /api/tests/unlock
exports.unlockTest = async (req, res) => {
  try {
    const { testId } = req.body;
    const cost = 5; // Fixed cost: 5 crystals per test

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if already unlocked
    const alreadyUnlocked = user.unlockedTests.some(t => t.testId === testId);
    if (alreadyUnlocked) {
      return res.json({ 
        success: true, 
        alreadyUnlocked: true,
        message: "Test already unlocked"
      });
    }

    // Check crystals
    if (user.crystals < cost) {
      return res.status(400).json({ 
        message: `Not enough crystals. Need ${cost} crystals`,
        currentCrystals: user.crystals,
        requiredCrystals: cost
      });
    }

    // Unlock test
    user.crystals -= cost;
    user.unlockedTests.push({ testId });
    
    // Add transaction record
    user.transactions.push({
      type: 'unlock_test',
      crystalsChange: -cost,
      description: `Unlocked test: ${testId}`,
      testId: testId
    });

    await user.save();

    res.json({ 
      success: true, 
      crystals: user.crystals,
      unlockedTests: user.unlockedTests.map(t => t.testId),
      message: "Test unlocked successfully" 
    });
  } catch (error) {
    console.error("Unlock test error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Check if test is unlocked
// @route   GET /api/tests/:testId/status
exports.checkTestUnlocked = async (req, res) => {
  try {
    const { testId } = req.params;
    
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isUnlocked = user.unlockedTests.some(t => t.testId === testId);

    res.json({ 
      unlocked: isUnlocked,
      crystals: user.crystals,
      gold: user.gold
    });
  } catch (error) {
    console.error("Check test error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Get transaction history
// @route   GET /api/wallet/transactions
exports.getTransactions = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('transactions');
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Return transactions sorted by date (newest first)
    const transactions = user.transactions.sort((a, b) => 
      new Date(b.timestamp) - new Date(a.timestamp)
    );

    res.json(transactions);
  } catch (error) {
    console.error("Get transactions error:", error);
    res.status(500).json({ message: "Server error" });
  }
};