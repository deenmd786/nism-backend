const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  googleId: { type: String, unique: true, sparse: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  photoUrl: { type: String },
  password: { type: String }, // For email/password auth if needed
  
  // Coin System
  gold: { type: Number, default: 0 },
  crystals: { type: Number, default: 0 },
  
  // Track which tests are unlocked
  unlockedTests: [{ 
    testId: String,        // e.g., "series1_test_1"
    unlockedAt: { type: Date, default: Date.now }
  }],
  
  // ✅ SECURITY: Store successful payment IDs so users can't reuse them
  processedPayments: [{ type: String }] 

}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);