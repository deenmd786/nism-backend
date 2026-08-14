const express = require('express');
const router = express.Router();
const { 
  registerUser, 
  loginUser, 
  googleLogin, 
  getMe 
} = require('../controllers/authController');

// Clean and direct middleware import
const auth = require('../middleware/authMiddleware');

// Routes (Ready for both Google and Email/Password)
router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/google', googleLogin);
router.get('/me', auth, getMe); 

module.exports = router;