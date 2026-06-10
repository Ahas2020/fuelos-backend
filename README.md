# FuelOS Backend API

نظام تشغيل محطات الوقود — الـ Backend

## البنية

```
fuelos-backend/
├── server.js                    ← نقطة البداية
├── src/
│   ├── config/
│   │   ├── supabase.js          ← اتصال قاعدة البيانات
│   │   └── schema.sql           ← SQL للنسخ في Supabase
│   ├── controllers/
│   │   ├── authController.js    ← تسجيل الدخول والحسابات
│   │   ├── salesController.js   ← المبيعات والوردايات
│   │   ├── deliveryController.js← رصد التوريد
│   │   └── dashboardController.js← لوحة التحكم
│   ├── middleware/
│   │   └── auth.js              ← حماية المسارات
│   └── routes/
│       └── index.js             ← كل المسارات
└── railway.json                 ← نشر على Railway
```

## خطوات الإعداد

### 1. Supabase (قاعدة البيانات)
1. اذهب إلى https://supabase.com وأنشئ مشروعاً مجانياً
2. افتح **SQL Editor**
3. انسخ محتوى `src/config/schema.sql` والصقه واضغط Run
4. من **Project Settings → API** انسخ:
   - Project URL
   - anon/public key
   - service_role key

### 2. متغيرات البيئة
انسخ `.env.example` إلى `.env` وأضف مفاتيح Supabase:
```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...
JWT_SECRET=اكتب_كلمة_سر_طويلة_هنا
```

### 3. تشغيل محلي
```bash
npm install
node server.js
```
API يعمل على: http://localhost:3000

### 4. النشر على Railway (مجاني)
1. اذهب إلى https://railway.app
2. New Project → Deploy from GitHub Repo
3. أضف متغيرات البيئة في Settings → Variables
4. يعطيك رابط مجاني تلقائياً

## المسارات الرئيسية

### Auth
- `POST /api/auth/register` — تسجيل محطة جديدة
- `POST /api/auth/login` — تسجيل الدخول
- `GET /api/auth/me` — بيانات المستخدم الحالي

### Dashboard
- `GET /api/dashboard` — لوحة التحكم الكاملة
- `GET /api/dashboard/daily?date=2025-01-15` — تقرير يوم محدد

### المبيعات
- `POST /api/shifts/open` — فتح وردية
- `POST /api/shifts/close` — إغلاق وردية
- `POST /api/sales/fuel` — تسجيل بيعة وقود
- `POST /api/sales/store` — تسجيل بيعة متجر
- `GET /api/sales/today` — مبيعات اليوم
- `GET /api/sales/report?from=2025-01-01&to=2025-01-31` — تقرير فترة

### التوريد
- `POST /api/deliveries` — تسجيل شحنة جديدة
- `GET /api/deliveries` — سجل التوريدات
- `GET /api/deliveries/alerts` — تنبيهات النقص

## مثال استخدام API

```javascript
// تسجيل الدخول
const res = await fetch('https://your-api.railway.app/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'owner@station.com', password: '123456' })
});
const { token } = await res.json();

// جلب لوحة التحكم
const dashboard = await fetch('https://your-api.railway.app/api/dashboard', {
  headers: { 'Authorization': `Bearer ${token}` }
});
```
