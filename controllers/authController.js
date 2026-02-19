const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// --- 1. Define Functions ---

const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      gold: 0,
      crystals: 0,
      unlockedTests: [],
      transactions: []
    });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);

    res.json({ 
      token, 
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        gold: user.gold,
        crystals: user.crystals
      } 
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);

    res.json({ 
      token, 
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        gold: user.gold,
        crystals: user.crystals
      } 
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const googleLogin = async (req, res) => {
  try {
    const { token } = req.body;

    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    let user = await User.findOne({ email: payload.email });

    if (!user) {
      user = await User.create({
        name: payload.name,
        email: payload.email,
        googleId: payload.sub,
        photoUrl: payload.picture,
        gold: 0,
        crystals: 0,
        unlockedTests: [],
        transactions: []
      });
    }

    const jwtToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET);

    res.json({ 
      token: jwtToken, 
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        photoUrl: user.photoUrl,
        gold: user.gold,
        crystals: user.crystals
      } 
    });
  } catch (error) {
    console.error("Google login error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (error) {
    console.error("Get Me Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// --- 2. EXPORT EVERYTHING AT THE BOTTOM ---
// This ensures 'getMe' is definitely included
module.exports = {
  registerUser,
  loginUser,
  googleLogin,
  getMe
};