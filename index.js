const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

const { register, login, me } = require('../controllers/authController');
const { openShift, closeShift, recordSale, recordStoreSale, getTodaySales, getSalesReport } = require('../controllers/salesController');
const { createDelivery, getDeliveries, getShortageAlert } = require('../controllers/deliveryController');
const { getDashboard, getDailyReport } = require('../controllers/dashboardController');

// AUTH
router.post('/auth/register', register);
router.post('/auth/login', login);
router.get('/auth/me', auth, me);

// DASHBOARD
router.get('/dashboard', auth, getDashboard);
router.get('/dashboard/daily', auth, getDailyReport);

// SALES & SHIFTS
router.post('/shifts/open', auth, openShift);
router.post('/shifts/close', auth, closeShift);
router.post('/sales/fuel', auth, recordSale);
router.post('/sales/store', auth, recordStoreSale);
router.get('/sales/today', auth, getTodaySales);
router.get('/sales/report', auth, getSalesReport);

// DELIVERIES
router.post('/deliveries', auth, createDelivery);
router.get('/deliveries', auth, getDeliveries);
router.get('/deliveries/alerts', auth, getShortageAlert);

module.exports = router;
