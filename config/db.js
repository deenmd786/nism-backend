const mongoose = require("mongoose");
const dns = require("dns"); // ✅ 1. Import the DNS module

// ✅ 2. Force Node.js to use Google and Cloudflare DNS to bypass local network blocking
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB Connected");
  } catch (error) {
    console.error("MongoDB Connection Error:", error);
    process.exit(1);
  }
};

module.exports = connectDB;