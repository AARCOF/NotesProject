const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'noteyou_super_secreto_2026';

function verifyAuthToken(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader) return null;

  const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
    ? authHeader.substring(7)
    : authHeader;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (err) {
    return null;
  }
}

function generateJwtToken(user, expiresIn = '7d') {
  const payload = {
    sub: user.id || user._id,
    name: user.name,
    email: user.email,
    role: user.role || 'user'
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

module.exports = {
  verifyAuthToken,
  generateJwtToken
};
