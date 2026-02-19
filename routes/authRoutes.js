const express = require('express');
const router = express.Router();
const { 
  registerUser, 
  loginUser, 
  googleLogin, 
  getMe // <--- MAKE SURE THIS IS IMPORTED
} = require('../controllers/authController');

const { auth } = require('../middleware/authMiddleware'); // Import the middleware we fixed

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/google', googleLogin);

// 🔹 This is the route Flutter calls
router.get('/me', auth, getMe); 

module.exports = router;