/**
 * Authentication Routes
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');

// Mock user database (in production, use a real database)
const users = new Map();
const sessions = new Map();

/**
 * Generate API token
 */
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: username, email, password'
      });
    }

    // Check if user exists
    let userExists = false;
    users.forEach(user => {
      if (user.username === username || user.email === email) {
        userExists = true;
      }
    });

    if (userExists) {
      return res.status(400).json({
        success: false,
        error: 'User already exists'
      });
    }

    // Create user
    const userId = `user_${crypto.randomBytes(8).toString('hex')}`;
    const apiToken = generateToken();

    users.set(userId, {
      id: userId,
      username,
      email,
      password: password, // In production, hash this!
      apiToken,
      createdAt: new Date().toISOString(),
      role: 'user'
    });

    req.session.userId = userId;
    req.session.username = username;
    req.session.role = 'user';

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: {
        id: userId,
        username,
        email,
        apiToken
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Registration failed'
    });
  }
});

/**
 * POST /api/auth/login
 * Login user
 */
router.post('/login', (req, res) => {
  try {
    const { username, email, password } = req.body;

    if ((!username && !email) || !password) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    // Find user
    let foundUser = null;
    users.forEach(user => {
      if ((user.username === username || user.email === email) && user.password === password) {
        foundUser = user;
      }
    });

    if (!foundUser) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Set session
    req.session.userId = foundUser.id;
    req.session.username = foundUser.username;
    req.session.role = foundUser.role;

    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: foundUser.id,
        username: foundUser.username,
        email: foundUser.email
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed'
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout user
 */
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        error: 'Logout failed'
      });
    }
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  });
});

/**
 * GET /api/auth/me
 * Get current user
 */
router.get('/me', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({
      success: false,
      error: 'Not authenticated'
    });
  }

  const user = users.get(req.session.userId);
  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'User not found'
    });
  }

  res.json({
    success: true,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    }
  });
});

module.exports = router;
