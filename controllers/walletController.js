const User = require("../models/User");
const Razorpay = require("razorpay");
const crypto = require("crypto");

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// 1. Get Wallet Data (Removed transactions)
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

// 2. Add Gold (Removed transactions.push)
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

// 3. Exchange Gold for Crystals (Updated: 500 Gold = 1 Crystal)
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

// 4. Unlock Test (Removed transactions.push)
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

// 5. Check Test Unlocked (No changes needed)
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

// --- RAZORPAY FUNCTIONS ---

// 6. Create Razorpay Order
const createRazorpayOrder = async (req, res) => {
  try {
    const { amountInRupees } = req.body;
    
    if (!amountInRupees || amountInRupees <= 0) {
      return res.status(400).json({ message: "Invalid amount" });
    }

    const options = {
      amount: amountInRupees * 100, // Razorpay uses paise
      currency: "INR",
      receipt: `receipt_${req.user.id}_${Date.now()}`
    };

    const order = await razorpay.orders.create(options);
    res.json({ success: true, order_id: order.id, amount: options.amount });
  } catch (error) {
    console.error("Create Razorpay order error:", error);
    res.status(500).json({ message: "Server error creating order" });
  }
};

// 7. Verify Razorpay Payment (Removed transactions.push, kept processedPayments check)
const verifyRazorpayPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, goldReward } = req.body;

    const generated_signature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest('hex');

    if (generated_signature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: "Invalid signature! Scam detected." });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.processedPayments && user.processedPayments.includes(razorpay_payment_id)) {
      return res.status(400).json({ success: false, message: "Reward already claimed." });
    }

    const rewardAmount = parseInt(goldReward) || 0;
    user.gold = (user.gold || 0) + rewardAmount;
    
    if (!user.processedPayments) user.processedPayments = [];
    user.processedPayments.push(razorpay_payment_id);

    await user.save();
    
    res.json({ 
      success: true, 
      gold: user.gold, 
      crystals: user.crystals, 
      message: `Successfully added ${rewardAmount} gold!` 
    });

  } catch (error) {
    console.error("Verify Razorpay payment error:", error);
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
  createRazorpayOrder,
  verifyRazorpayPayment
};