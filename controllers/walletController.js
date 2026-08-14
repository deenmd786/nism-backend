const User = require("../models/User");
const { google } = require('googleapis');
const { sendEmailNotification } = require('../services/emailService'); // ✅ Email Service Imported
const { crystalPurchaseTemplate, adBlockerTemplate } = require('../utils/emailTemplates');

// ==========================================
// 🛡️ GOOGLE PLAY AUTHENTICATION (PRODUCTION)
// ==========================================
if (!process.env.GOOGLE_BASE64_CREDENTIALS) {
    console.error("FATAL ERROR: GOOGLE_BASE64_CREDENTIALS environment variable is missing.");
}

// Decode the Base64 string from environment variables
const credentials = process.env.GOOGLE_BASE64_CREDENTIALS
    ? JSON.parse(Buffer.from(process.env.GOOGLE_BASE64_CREDENTIALS, 'base64').toString('utf-8'))
    : {};

const auth = new google.auth.GoogleAuth({
    credentials: credentials,
    scopes: ['https://www.googleapis.com/auth/androidpublisher']
});

const androidPublisher = google.androidpublisher({ version: 'v3', auth });

// 🛡️ SECURE REWARD MAP (Matches your Flutter Product IDs)
const CRYSTAL_REWARDS = {
    'crystal_pack_49': 7,
    'crystal_pack_99': 17,
    'crystal_pack_149': 27,
    'crystal_pack_249': 48,
    'crystal_pack_499': 100
};

// ==========================================
// 1. Get Wallet Data
// ==========================================
const getWalletData = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('gold crystals unlockedTests referralCode hasClaimedReferral adsRemovedUntil');
        if (!user) return res.status(404).json({ message: "User not found" });

        if (!user.referralCode) {
            user.referralCode = "NISM" + user._id.toString().substring(0, 6).toUpperCase();
            await user.save();
        }

        // Check if the adsRemovedUntil date is in the future
        const now = new Date();
        const hasRemovedAds = user.adsRemovedUntil ? user.adsRemovedUntil > now : false;

        res.json({
            gold: user.gold || 0,
            crystals: user.crystals || 0,
            unlockedTests: user.unlockedTests ? user.unlockedTests.map(t => t.testId) : [],
            referralCode: user.referralCode,
            hasClaimedReferral: user.hasClaimedReferral || false,
            hasRemovedAds: hasRemovedAds,
            adsRemovedUntil: user.adsRemovedUntil // ✅ Sent to Flutter for countdown timer
        });
    } catch (error) {
        console.error("Get wallet error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// ==========================================
// 2. Remove Ads (Dynamic Pricing & Email)
// ==========================================
const removeAds = async (req, res) => {
    try {
        const { plan } = req.body;
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: "User not found" });

        // --- SECURE SERVER-SIDE PRICING LOGIC ---
        const now = new Date();

        // Independence Day offer ends: August 22, 2026 at 23:59:59 (Month 7 = August in JS!)
        const independenceDayEnd = new Date(2026, 7, 22, 23, 59, 59);

        let currentOffer = 'none';

        if (now <= independenceDayEnd) {
            currentOffer = 'independence';
        } else if (now.getDay() === 6 || (now.getDay() === 0 && now.getHours() < 12)) {
            // Saturday (all day, day 6) OR Sunday (before 12 PM, day 0)
            currentOffer = 'weekend';
        }

        let cost = 0;
        let monthsToAdd = 0;

        if (plan === '1_month') {
            if (currentOffer === 'independence') cost = 5;
            else if (currentOffer === 'weekend') cost = 7;
            else cost = 10;
            monthsToAdd = 1;
        } else if (plan === '1_year') {
            if (currentOffer === 'independence') cost = 20;
            else if (currentOffer === 'weekend') cost = 40;
            else cost = 120;
            monthsToAdd = 12;
        } else {
            return res.status(400).json({ message: "Invalid plan selected" });
        }

        if ((user.crystals || 0) < cost) {
            return res.status(400).json({ message: "Not enough crystals" });
        }

        // Deduct crystals
        user.crystals -= cost;

        // Calculate new expiration date
        let newExpiry = user.adsRemovedUntil && user.adsRemovedUntil > now
            ? new Date(user.adsRemovedUntil)
            : new Date();

        newExpiry.setMonth(newExpiry.getMonth() + monthsToAdd);
        user.adsRemovedUntil = newExpiry;

        await user.save();

        // ✅ Send Background Email 
        if (user.email) {
            await sendEmailNotification(
                user.email,
                "🚫 Ad-Free Activated!",
                adBlockerTemplate(user.name || 'Student')
            );
        }

        res.json({ success: true, crystals: user.crystals, hasRemovedAds: true, expiry: user.adsRemovedUntil });
    } catch (error) {
        console.error("Remove ads error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// ==========================================
// 🛡️ GOOGLE PLAY VERIFICATION (With Email)
// ==========================================
const verifyGooglePlayPurchase = async (req, res) => {
    try {
        const { productId, purchaseToken } = req.body;

        if (!purchaseToken || !productId) {
            return res.status(400).json({ success: false, message: "Missing purchase data" });
        }

        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: "User not found" });

        // 1. EARLY REPLAY PROTECTION
        if (user.processedPayments && user.processedPayments.includes(purchaseToken)) {
            return res.status(400).json({ success: false, message: "Reward already claimed." });
        }

        // 2. GOOGLE VERIFICATION
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

        // 4. SECURE REWARD
        const rewardAmount = CRYSTAL_REWARDS[productId];
        if (!rewardAmount) {
            return res.status(400).json({ success: false, message: "Invalid Product ID" });
        }

        // 5. ATOMIC UPDATE USER
        const updatedUser = await User.findOneAndUpdate(
            { _id: req.user.id, processedPayments: { $ne: purchaseToken } },
            {
                $inc: { crystals: rewardAmount },
                $push: { processedPayments: purchaseToken }
            },
            { new: true }
        );

        if (!updatedUser) {
            return res.status(400).json({ success: false, message: "Reward already claimed or user not found" });
        }

        // 6. ACKNOWLEDGE PURCHASE
        try {
            await androidPublisher.purchases.products.acknowledge({
                packageName: 'com.digroz.learning',
                productId: productId,
                token: purchaseToken,
            });
            console.log(`Purchase ${purchaseToken} acknowledged successfully.`);
        } catch (ackErr) {
            console.warn("Acknowledge failed/already acknowledged:", ackErr.message);
        }

        // ✅ Send Background Email (No await)
        if (updatedUser.email) {
            await sendEmailNotification(
                updatedUser.email,
                "💎 Crystal Purchase Successful!",
                crystalPurchaseTemplate(updatedUser.name || 'Student', rewardAmount) // 👇 USING YOUR TEMPLATE
            );
        }

        // 7. RETURN SUCCESS
        res.json({
            success: true,
            crystals: updatedUser.crystals,
            message: `Success! Added ${rewardAmount} crystals.`
        });

    } catch (err) {
        console.error("Google API Detail:", err.response?.data || err.message);
        return res.status(400).json({
            success: false,
            message: "Google verification failed",
            detail: err.response?.data?.error?.message
        });
    }
};

// ==========================================
// --- DAILY BONUS LOGIC ---
// ==========================================
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

// ==========================================
// --- EXCHANGES & TESTS ---
// ==========================================
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
// --- REFERRAL SYSTEM ---
// ==========================================
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

const addGold = async (req, res) => {
    try {
        const { amount } = req.body;
        const user = await User.findById(req.user.id);

        user.gold = (user.gold || 0) + amount;
        await user.save();

        res.json({ success: true, gold: user.gold });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

module.exports = {
    getWalletData, addGold, exchangeGoldForCrystals, unlockTest,
    checkTestUnlocked, verifyGooglePlayPurchase, getDailyBonusStatus,
    claimDailyBonus, claimReferralCode, removeAds
};