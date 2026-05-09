const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  googleId: { type: String, unique: true, sparse: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  photoUrl: { type: String },
  password: { type: String }, 
  
  // Coin System
  gold: { type: Number, default: 0 },
  crystals: { type: Number, default: 0 },
  
  // Track which tests are unlocked
  unlockedTests: [{ 
    testId: String,        
    unlockedAt: { type: Date, default: Date.now }
  }],
  
  // Security: Store successful payment IDs
  processedPayments: {
    type: [String],
    default: []
  },

  // ✅ NEW: Unique referral code for the user to share
  referralCode: { 
    type: String, 
    unique: true, 
    sparse: true // sparse allows it to be null/missing for old users until they login
  },
  // ✅ NEW: Track if the user has already claimed a referral code
  hasClaimedReferral: { 
    type: Boolean, 
    default: false 
  },
  referredBy: {
    type: String, // Store the ID of the person who referred them (optional but good for tracking)
    default: null
  },

  // ✅ NEW: Timestamp to track the Daily Bonus securely
  lastDailyClaim: { 
    type: Date, 
    default: null 
  }

}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);