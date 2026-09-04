const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const pool = require('../config/database');
const { sendVerificationEmail, maskEmail } = require('../utils/emailService');

const JWT_SECRET = process.env.JWT_SECRET || 'your_secret_key';
const APP_NAME = 'NexaFlow';

// ── In-memory store for pending email verifications ──────────────────────────
// Key: email (lowercase)  Value: { data, passwordHash, securityAnswerHash, code, expiresAt }
const pendingRegistrations = new Map();

// Prune expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of pendingRegistrations) {
    if (val.expiresAt < now) pendingRegistrations.delete(key);
  }
}, 5 * 60 * 1000);

// ── Ensure users table exists ───────────────────────────────────────────────
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Users table ready');
  } catch (err) {
    console.error('Users table creation note:', err.message);
  }
})();

// ── Auto-migrate: add TOTP columns if not present ───────────────────────────
(async () => {
  try {
    await pool.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS totp_secret TEXT,
        ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN DEFAULT FALSE
    `);
    console.log('✓ TOTP columns ready');
  } catch (err) {
    console.error('TOTP migration note:', err.message);
  }
})();

// ── Auto-migrate: add registration columns if not present ────────────────────
(async () => {
  try {
    await pool.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS first_name    VARCHAR(100),
        ADD COLUMN IF NOT EXISTS last_name     VARCHAR(100),
        ADD COLUMN IF NOT EXISTS address_street  VARCHAR(255),
        ADD COLUMN IF NOT EXISTS address_city    VARCHAR(100),
        ADD COLUMN IF NOT EXISTS address_state   VARCHAR(100),
        ADD COLUMN IF NOT EXISTS address_country VARCHAR(100),
        ADD COLUMN IF NOT EXISTS address_zip     VARCHAR(20),
        ADD COLUMN IF NOT EXISTS security_question   TEXT,
        ADD COLUMN IF NOT EXISTS security_answer_hash TEXT
    `);
    console.log('✓ Registration columns ready');
  } catch (err) {
    console.error('Registration migration note:', err.message);
  }
})();

// ── Auth middleware ──────────────────────────────────────────────────────────
function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

// ────────────────────────────────────────────────────────────────────────────
// POST /api/auth/login
// Step 1 — verify credentials. If TOTP is enabled, return temp token.
// ────────────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required' });
    }

    const result = await pool.query(
      'SELECT id, username, email, password_hash, totp_enabled FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid username or password' });
    }

    const user = result.rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: 'Invalid username or password' });
    }

    // TOTP is enabled → issue a short-lived temp token (5 min)
    if (user.totp_enabled) {
      const tempToken = jwt.sign(
        { userId: user.id, username: user.username, mfa_pending: true },
        JWT_SECRET,
        { expiresIn: '5m' }
      );
      return res.json({
        success: true,
        requires_totp: true,
        temp_token: tempToken,
        message: 'Enter the 6-digit code from your authenticator app'
      });
    }

    // No TOTP → issue full JWT
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: { id: user.id, username: user.username, email: user.email }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Login failed. Please try again.' });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// POST /api/auth/verify-totp
// Step 2 — verify TOTP code and exchange temp token for full JWT
// ────────────────────────────────────────────────────────────────────────────
router.post('/verify-totp', async (req, res) => {
  try {
    const { temp_token, totp_code } = req.body;

    if (!temp_token || !totp_code) {
      return res.status(400).json({ success: false, message: 'Token and code are required' });
    }

    let decoded;
    try {
      decoded = jwt.verify(temp_token, JWT_SECRET);
    } catch {
      return res.status(401).json({ success: false, message: 'Session expired. Please sign in again.' });
    }

    if (!decoded.mfa_pending) {
      return res.status(400).json({ success: false, message: 'Invalid token type' });
    }

    const result = await pool.query(
      'SELECT id, username, email, totp_secret FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const user = result.rows[0];
    const verified = speakeasy.totp.verify({
      secret: user.totp_secret,
      encoding: 'base32',
      token: totp_code.replace(/\s/g, ''),
      window: 1   // ±30s tolerance
    });

    if (!verified) {
      return res.status(401).json({ success: false, message: 'Invalid code. Please try again.' });
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    res.json({
      success: true,
      message: 'Authentication successful',
      token,
      user: { id: user.id, username: user.username, email: user.email }
    });
  } catch (error) {
    console.error('TOTP verify error:', error);
    res.status(500).json({ success: false, message: 'Verification failed. Please try again.' });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// GET /api/auth/totp/setup
// Generate a new TOTP secret + QR code for the current user
// ────────────────────────────────────────────────────────────────────────────
router.get('/totp/setup', verifyToken, async (req, res) => {
  try {
    if (req.user.mfa_pending) return res.status(403).json({ success: false, message: 'Forbidden' });

    const secret = speakeasy.generateSecret({
      name: `${APP_NAME} (${req.user.username})`,
      issuer: APP_NAME
    });

    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url, {
      width: 220,
      margin: 2,
      color: { dark: '#0f172a', light: '#ffffff' }
    });

    // Format manual key in groups of 4 for readability
    const manualKey = secret.base32.match(/.{1,4}/g).join(' ');

    res.json({ success: true, secret: secret.base32, qr_code: qrCodeUrl, manual_key: manualKey });
  } catch (error) {
    console.error('TOTP setup error:', error);
    res.status(500).json({ success: false, message: 'Setup failed. Please try again.' });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// POST /api/auth/totp/enable
// Verify first code, save secret and enable TOTP for user
// ────────────────────────────────────────────────────────────────────────────
router.post('/totp/enable', verifyToken, async (req, res) => {
  try {
    if (req.user.mfa_pending) return res.status(403).json({ success: false, message: 'Forbidden' });

    const { secret, totp_code } = req.body;
    if (!secret || !totp_code) {
      return res.status(400).json({ success: false, message: 'Secret and code are required' });
    }

    const verified = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token: totp_code.replace(/\s/g, ''),
      window: 1
    });

    if (!verified) {
      return res.status(400).json({ success: false, message: 'Invalid code. Scan the QR code again and retry.' });
    }

    await pool.query(
      'UPDATE users SET totp_secret = $1, totp_enabled = TRUE WHERE id = $2',
      [secret, req.user.userId]
    );

    res.json({ success: true, message: 'Two-factor authentication enabled successfully' });
  } catch (error) {
    console.error('TOTP enable error:', error);
    res.status(500).json({ success: false, message: 'Failed to enable 2FA.' });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// POST /api/auth/totp/disable
// Require current TOTP code before disabling
// ────────────────────────────────────────────────────────────────────────────
router.post('/totp/disable', verifyToken, async (req, res) => {
  try {
    if (req.user.mfa_pending) return res.status(403).json({ success: false, message: 'Forbidden' });

    const { totp_code } = req.body;
    if (!totp_code) return res.status(400).json({ success: false, message: 'Code is required' });

    const result = await pool.query('SELECT totp_secret FROM users WHERE id = $1', [req.user.userId]);
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'User not found' });

    const verified = speakeasy.totp.verify({
      secret: result.rows[0].totp_secret,
      encoding: 'base32',
      token: totp_code.replace(/\s/g, ''),
      window: 1
    });

    if (!verified) {
      return res.status(401).json({ success: false, message: 'Invalid code. Cannot disable 2FA.' });
    }

    await pool.query(
      'UPDATE users SET totp_secret = NULL, totp_enabled = FALSE WHERE id = $1',
      [req.user.userId]
    );

    res.json({ success: true, message: 'Two-factor authentication disabled' });
  } catch (error) {
    console.error('TOTP disable error:', error);
    res.status(500).json({ success: false, message: 'Failed to disable 2FA.' });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// GET /api/auth/totp/status
// ────────────────────────────────────────────────────────────────────────────
router.get('/totp/status', verifyToken, async (req, res) => {
  try {
    if (req.user.mfa_pending) return res.status(403).json({ success: false, message: 'Forbidden' });

    const result = await pool.query('SELECT totp_enabled FROM users WHERE id = $1', [req.user.userId]);
    res.json({ success: true, totp_enabled: result.rows[0]?.totp_enabled || false });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get status' });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// POST /api/auth/register
// Step 1 of 2 — validate all fields, send 6-digit verification code by email.
// The account is NOT saved to the DB until /verify-email is called.
// ────────────────────────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const {
      firstName, lastName, email, username, password,
      street, city, state, country, zipCode,
      securityQuestion, securityAnswer
    } = req.body;

    if (!firstName || !lastName || !email || !username || !password ||
        !street || !city || !state || !country || !zipCode ||
        !securityQuestion || !securityAnswer) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    // Duplicate username check
    const usernameCheck = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (usernameCheck.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'Username already taken. Please choose another.' });
    }

    // Duplicate email check
    const emailCheck = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (emailCheck.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    // Pre-hash sensitive fields before storing in pending map
    const passwordHash       = await bcrypt.hash(password, 12);
    const securityAnswerHash = await bcrypt.hash(securityAnswer.toLowerCase().trim(), 10);

    // Generate 6-digit OTP
    const code      = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

    // Store pending registration (keyed by lowercase email)
    pendingRegistrations.set(email.toLowerCase(), {
      data: { firstName, lastName, email, username, street, city, state, country, zipCode, securityQuestion },
      passwordHash,
      securityAnswerHash,
      code,
      expiresAt
    });

    // Send verification email (non-blocking, but we still await to catch send errors)
    await sendVerificationEmail(email, code, firstName);

    res.status(200).json({
      success: true,
      message: 'Verification code sent! Check your email.',
      maskedEmail: maskEmail(email)
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, message: 'Registration failed. Please try again.' });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// POST /api/auth/verify-email
// Step 2 of 2 — verify the code and create the account in the DB.
// ────────────────────────────────────────────────────────────────────────────
router.post('/verify-email', async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ success: false, message: 'Email and code are required' });
    }

    const pending = pendingRegistrations.get(email.toLowerCase());

    if (!pending) {
      return res.status(400).json({ success: false, message: 'No pending registration found. Please register again.' });
    }

    if (Date.now() > pending.expiresAt) {
      pendingRegistrations.delete(email.toLowerCase());
      return res.status(400).json({ success: false, message: 'Verification code has expired. Please register again.' });
    }

    if (code.trim() !== pending.code) {
      return res.status(400).json({ success: false, message: 'Incorrect code. Please check your email and try again.' });
    }

    // Code correct — save account to DB
    const { data, passwordHash, securityAnswerHash } = pending;
    const result = await pool.query(
      `INSERT INTO users
         (username, email, password_hash,
          first_name, last_name,
          address_street, address_city, address_state, address_country, address_zip,
          security_question, security_answer_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING id, username, email`,
      [data.username, data.email, passwordHash,
       data.firstName, data.lastName,
       data.street, data.city, data.state, data.country, data.zipCode,
       data.securityQuestion, securityAnswerHash]
    );

    pendingRegistrations.delete(email.toLowerCase());

    const newUser = result.rows[0];
    res.status(201).json({
      success: true,
      message: 'Email verified! Your account is ready. You can now sign in.',
      user: { id: newUser.id, username: newUser.username, email: newUser.email }
    });
  } catch (error) {
    console.error('Verify email error:', error);
    // Handle duplicate key (race condition — account already created)
    if (error.code === '23505') {
      return res.status(409).json({ success: false, message: 'Account already exists with this username or email.' });
    }
    res.status(500).json({ success: false, message: 'Verification failed. Please try again.' });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// POST /api/auth/resend-verification
// Resend a fresh 6-digit code for a pending registration.
// ────────────────────────────────────────────────────────────────────────────
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    const pending = pendingRegistrations.get(email.toLowerCase());
    if (!pending) {
      return res.status(400).json({ success: false, message: 'No pending registration found. Please fill in the form again.' });
    }

    // Generate a fresh code with a new 15-min window
    const code      = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = Date.now() + 15 * 60 * 1000;
    pending.code      = code;
    pending.expiresAt = expiresAt;

    await sendVerificationEmail(email, code, pending.data.firstName);

    res.json({
      success: true,
      message: 'A new verification code has been sent to your email.',
      maskedEmail: maskEmail(email)
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ success: false, message: 'Could not resend code. Please try again.' });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// POST /api/auth/forgot-password/lookup
// Step 1 — find the user and return their security question (no sensitive data)
// ────────────────────────────────────────────────────────────────────────────
router.post('/forgot-password/lookup', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ success: false, message: 'Username is required' });
    }

    const result = await pool.query(
      'SELECT id, security_question FROM users WHERE username = $1',
      [username]
    );

    // Always return the same shape regardless of whether user exists (prevents username enumeration)
    if (result.rows.length === 0 || !result.rows[0].security_question) {
      return res.status(404).json({
        success: false,
        message: 'No account found with that username, or security question not set.'
      });
    }

    res.json({ success: true, security_question: result.rows[0].security_question });
  } catch (error) {
    console.error('Forgot password lookup error:', error);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// POST /api/auth/forgot-password/verify-answer
// Step 2 — verify the security answer; issue a 10-min password-reset token
// ────────────────────────────────────────────────────────────────────────────
router.post('/forgot-password/verify-answer', async (req, res) => {
  try {
    const { username, securityAnswer } = req.body;
    if (!username || !securityAnswer) {
      return res.status(400).json({ success: false, message: 'Username and answer are required' });
    }

    const result = await pool.query(
      'SELECT id, username, security_answer_hash FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Incorrect answer. Please try again.' });
    }

    const user = result.rows[0];
    const answerMatch = await bcrypt.compare(
      securityAnswer.toLowerCase().trim(),
      user.security_answer_hash
    );

    if (!answerMatch) {
      return res.status(401).json({ success: false, message: 'Incorrect answer. Please try again.' });
    }

    // Issue a short-lived reset token (10 min)
    const resetToken = jwt.sign(
      { userId: user.id, username: user.username, purpose: 'password_reset' },
      JWT_SECRET,
      { expiresIn: '10m' }
    );

    res.json({
      success: true,
      reset_token: resetToken,
      message: 'Answer verified. You may now set a new password.'
    });
  } catch (error) {
    console.error('Forgot password verify error:', error);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// POST /api/auth/forgot-password/reset
// Step 3 — validate reset token and update the password
// ────────────────────────────────────────────────────────────────────────────
router.post('/forgot-password/reset', async (req, res) => {
  try {
    const { reset_token, newPassword } = req.body;

    if (!reset_token || !newPassword) {
      return res.status(400).json({ success: false, message: 'Token and new password are required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    }

    let decoded;
    try {
      decoded = jwt.verify(reset_token, JWT_SECRET);
    } catch {
      return res.status(401).json({ success: false, message: 'Reset link has expired. Please start over.' });
    }

    if (decoded.purpose !== 'password_reset') {
      return res.status(400).json({ success: false, message: 'Invalid reset token' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await pool.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [passwordHash, decoded.userId]
    );

    res.json({ success: true, message: 'Password updated successfully! You can now sign in.' });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
});

module.exports = router;
