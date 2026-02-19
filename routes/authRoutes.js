const express = require('express');
const router = express.Router();
const { 
  registerUser, 
  loginUser, 
  googleLogin, 
  getMe 
} = require('../controllers/authController');

// --- SAFE MIDDLEWARE IMPORT ---
// This handles both "module.exports = function" and "exports.auth = function"
const authMiddleware = require('../middleware/authMiddleware');
const auth = typeof authMiddleware === 'function' ? authMiddleware : authMiddleware.auth;

// --- SAFETY CHECKS (Logs exactly what is missing) ---
if (typeof auth !== 'function') {
  console.error("❌ CRITICAL ERROR: 'auth' middleware is missing in authRoutes.js");
}
if (typeof getMe !== 'function') {
  console.error("❌ CRITICAL ERROR: 'getMe' controller is missing. Check authController.js exports.");
}

// Routes
router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/google', googleLogin);

// This is line 17 where it was crashing
router.get('/me', auth, getMe); 

module.exports = router;