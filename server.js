const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*' }));
app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    name: 'FuelOS API',
    version: '1.0.0',
    status: '✅ Running',
    message: 'نظام تشغيل محطات الوقود — API جاهز',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ FuelOS API running on port ${PORT}`);
});

module.exports = app;
