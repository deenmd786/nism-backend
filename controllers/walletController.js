const User = require("../models/User");
const { google } = require('googleapis');

// Google Play Auth Setup
const auth = new google.auth.GoogleAuth({
    keyFile: './nism-exam-prep-07-37fafc0a57d5.json',
    scopes: ['https://www.googleapis.com/auth/androidpublisher']
});
const androidPublisher = google.androidpublisher({ version: 'v3', auth });

// 🛡️ SECURE REWARD MAP (Matches your Flutter Product IDs)
const CRYSTAL_REWARDS = {
    'crystal_pack_49': 7,    // Example: 50 crystals for the 49 pack
    'crystal_pack_99': 17,   // Example amounts - adjust to your actual shop rates
    'crystal_pack_149': 27,
    'crystal_pack_249': 48,
    'crystal_pack_499': 100
};

// 1. Get Wallet Data
const getWalletData = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('gold crystals unlockedTests referralCode hasClaimedReferral');
        if (!user) return res.status(404).json({ message: "User not found" });

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

// 2. Add Gold (Ads only)
const addGold = async (req, res) => {
    try {
        const { amount } = req.body;
        if (!amount || amount <= 0) return res.status(400).json({ message: "Invalid amount" });

        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: "User not found" });

        user.gold = (user.gold || 0) + amount;
        await user.save();
        res.json({ success: true, gold: user.gold, message: `Added ${amount} gold` });
    } catch (error) {
        console.error("Add gold error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// --- DAILY BONUS LOGIC ---
const getDailyBonusStatus = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: "User not found" });

        const lastClaim = user.lastDailyClaim;
        let isAvailable = true;
        let nextAvailableTime = null;

        if (lastClaim) {
            const diffMs = new Date() - lastClaim;
            if (diffMs < 24 * 60 * 60 * 1000) {
                isAvailable = false;
                nextAvailableTime = new Date(lastClaim.getTime() + 24 * 60 * 60 * 1000);
            }
        }
        res.json({ isAvailable, nextAvailableTime });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

const claimDailyBonus = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: "User not found" });

        const now = new Date();
        const lastClaim = user.lastDailyClaim;

        if (lastClaim && (now - lastClaim < 24 * 60 * 60 * 1000)) {
            return res.status(400).json({ success: false, message: "Daily bonus not ready" });
        }

        user.gold = (user.gold || 0) + 50;
        user.lastDailyClaim = now;
        await user.save();
        res.json({ success: true, gold: user.gold, message: "Claimed 50 gold" });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

// --- EXCHANGES & TESTS ---
const exchangeGoldForCrystals = async (req, res) => {
    try {
        const { goldAmount } = req.body;
        if (goldAmount < 500) return res.status(400).json({ message: "Min 500 gold" });

        const crystalsToAdd = Math.floor(goldAmount / 500);
        const goldToDeduct = crystalsToAdd * 500;

        const user = await User.findById(req.user.id);
        if ((user.gold || 0) < goldToDeduct) return res.status(400).json({ message: "Not enough gold" });

        user.gold -= goldToDeduct;
        user.crystals = (user.crystals || 0) + crystalsToAdd;
        await user.save();
        res.json({ success: true, gold: user.gold, crystals: user.crystals });
    } catch (error) {
        res.status(500).json({ message: "Exchange error" });
    }
};

const unlockTest = async (req, res) => {
    try {
        const { testId } = req.body;
        const cost = 5;
        const user = await User.findById(req.user.id);

        if (user.unlockedTests?.some(t => t.testId === testId)) return res.json({ success: true, message: "Already unlocked" });
        if ((user.crystals || 0) < cost) return res.status(400).json({ message: "Not enough crystals" });

        user.crystals -= cost;
        user.unlockedTests.push({ testId });
        await user.save();
        res.json({ success: true, crystals: user.crystals });
    } catch (error) {
        res.status(500).json({ message: "Unlock error" });
    }
};

const checkTestUnlocked = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const isUnlocked = user.unlockedTests?.some(t => t.testId === req.params.testId) || false;
        res.json({ unlocked: isUnlocked });
    } catch (error) {
        res.status(500).json({ message: "Check error" });
    }
};

// ==========================================
// 🛡️ UPDATED: GOOGLE PLAY VERIFICATION
// ==========================================
const verifyGooglePlayPurchase = async (req, res) => {
    try {
        const { productId, purchaseToken } = req.body;

        if (!purchaseToken || !productId) {
            return res.status(400).json({ success: false, message: "Missing purchase data" });
        }

        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: "User not found" });

        // 1. EARLY REPLAY PROTECTION: Check if token already used (Saves Google API Call)
        if (user.processedPayments && user.processedPayments.includes(purchaseToken)) {
            return res.status(400).json({ success: false, message: "Reward already claimed." });
        }

        // 2. GOOGLE VERIFICATION: Validate with Google Servers
        let purchaseReceipt;
        try {
            const response = await androidPublisher.purchases.products.get({
                packageName: 'com.digroz.learning',
                productId: productId,
                token: purchaseToken
            });
            purchaseReceipt = response.data;
        } catch (err) {
            console.error("Google Auth Error:", err.message);
            return res.status(400).json({ success: false, message: "Invalid token" });
        }

        // 3. PURCHASE STATE: 0 = Purchased
        if (purchaseReceipt.purchaseState !== 0) {
            return res.status(400).json({ success: false, message: "Purchase incomplete" });
        }

        // 4. SECURE REWARD: Get amount from our SERVER map
        const rewardAmount = CRYSTAL_REWARDS[productId];
        if (!rewardAmount) {
            return res.status(400).json({ success: false, message: "Invalid Product ID" });
        }

        // 5. ATOMIC UPDATE USER (Prevents Race Conditions)
        const updatedUser = await User.findOneAndUpdate(
            { _id: req.user.id, processedPayments: { $ne: purchaseToken } }, // Only update if token NOT in array
            { 
                $inc: { crystals: rewardAmount },
                $push: { processedPayments: purchaseToken }
            },
            { new: true } // Returns the newly updated document
        );

        if (!updatedUser) {
            return res.status(400).json({ success: false, message: "Reward already claimed or user not found" });
        }

        // 6. CONSUME PURCHASE: Tell Google the item is delivered so they don't refund it
        try {
            await androidPublisher.purchases.products.consume({
                packageName: 'com.digroz.learning',
                productId: productId,
                token: purchaseToken
            });
        } catch (consumeErr) {
            console.warn("Consume failed (might be already consumed):", consumeErr.message);
        }

        res.json({ 
            success: true, 
            crystals: updatedUser.crystals, // Return the exact new total from the DB
            message: `Success! Added ${rewardAmount} crystals.` 
        });

    } catch (error) {
        console.error("Payment error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// --- REFERRAL SYSTEM ---
const claimReferralCode = async (req, res) => {
    try {
        const { code } = req.body;
        const currentUser = await User.findById(req.user.id);

        if (currentUser.hasClaimedReferral) return res.status(400).json({ message: "Already claimed" });
        if (currentUser.referralCode === code) return res.status(400).json({ message: "Cannot use own code" });

        const referrer = await User.findOne({ referralCode: code });
        if (!referrer) return res.status(404).json({ message: "Invalid code" });

        currentUser.gold += 100;
        currentUser.hasClaimedReferral = true;
        currentUser.referredBy = referrer._id;
        referrer.gold += 200;

        await Promise.all([currentUser.save(), referrer.save()]);
        res.json({ success: true, gold: currentUser.gold });
    } catch (error) {
        res.status(500).json({ message: "Referral error" });
    }
};

module.exports = { 
    getWalletData, addGold, exchangeGoldForCrystals, unlockTest, 
    checkTestUnlocked, verifyGooglePlayPurchase, getDailyBonusStatus, 
    claimDailyBonus, claimReferralCode 
};