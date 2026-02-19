const User = require("../models/User");

// 1. Define all functions first
const getWalletData = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('gold crystals unlockedTests transactions');
    if (!user) return res.status(404).json({ message: "User not found" });

    const recentTransactions = user.transactions ? user.transactions.slice(-10).reverse() : [];

    res.json({
      gold: user.gold || 0,
      crystals: user.crystals || 0,
      unlockedTests: user.unlockedTests ? user.unlockedTests.map(t => t.testId) : [],
      transactions: recentTransactions
    });
  } catch (error) {
    console.error("Get wallet error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const addGold = async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ message: "Invalid amount" });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.gold = (user.gold || 0) + amount;
    user.transactions.push({
      type: 'earn_gold',
      goldChange: amount,
      description: `Earned ${amount} gold from practice quiz`
    });

    await user.save();
    res.json({ success: true, gold: user.gold, crystals: user.crystals, message: `Added ${amount} gold` });
  } catch (error) {
    console.error("Add gold error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const exchangeGoldForCrystals = async (req, res) => {
  try {
    const { goldAmount } = req.body;
    if (goldAmount < 100) return res.status(400).json({ message: "Minimum 100 gold required" });

    const crystalsToAdd = Math.floor(goldAmount / 100);
    const goldToDeduct = crystalsToAdd * 100;

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if ((user.gold || 0) < goldToDeduct) {
      return res.status(400).json({ message: `Not enough gold. Need ${goldToDeduct}` });
    }

    user.gold -= goldToDeduct;
    user.crystals = (user.crystals || 0) + crystalsToAdd;
    user.transactions.push({
      type: 'exchange',
      goldChange: -goldToDeduct,
      crystalsChange: crystalsToAdd,
      description: `Exchanged ${goldToDeduct} gold for ${crystalsToAdd} crystals`
    });

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
    user.transactions.push({
      type: 'unlock_test',
      crystalsChange: -cost,
      description: `Unlocked test: ${testId}`,
      testId: testId
    });

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

const getTransactions = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('transactions');
    if (!user) return res.status(404).json({ message: "User not found" });

    const transactions = user.transactions ? user.transactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)) : [];
    res.json(transactions);
  } catch (error) {
    console.error("Get transactions error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// 2. EXPORT ALL AT THE END
// This is the most crucial part that was missing/broken
module.exports = {
  getWalletData,
  addGold,
  exchangeGoldForCrystals,
  unlockTest,
  checkTestUnlocked,
  getTransactions
};