const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'غير مصرح — يرجى تسجيل الدخول' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fuelos_secret');
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'جلسة منتهية — يرجى تسجيل الدخول مجدداً' });
  }
};

module.exports = authMiddleware;
