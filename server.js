require('dotenv').config();
const express = require('express');
const cors = require('cors');
const routes = require('./index');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/', (req, res) => {
  res.json({
    name: 'FuelOS API',
    version: '1.0.0',
    status: '✅ Running',
    message: 'نظام تشغيل محطات الوقود — API جاهز'
  });
});

// Routes
app.use('/api', routes);

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'المسار غير موجود' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'خطأ في الخادم' });
});

app.listen(PORT, () => {
  console.log(`✅ FuelOS API running on port ${PORT}`);
  console.log(`🌐 http://localhost:${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}/api/dashboard`);
});

module.exports = app;
