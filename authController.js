const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');

// تسجيل محطة جديدة + مالك
const register = async (req, res) => {
  try {
    const { stationName, ownerName, email, password, phone, city, country } = req.body;

    // التحقق من البريد
    const { data: existing } = await supabase
      .from('users').select('id').eq('email', email).single();
    if (existing) return res.status(400).json({ error: 'البريد الإلكتروني مستخدم مسبقاً' });

    // إنشاء المحطة
    const { data: station, error: stErr } = await supabase
      .from('stations')
      .insert({ name: stationName, owner_name: ownerName, phone, city, country: country || 'MA' })
      .select().single();
    if (stErr) throw stErr;

    // إنشاء المالك
    const hash = await bcrypt.hash(password, 12);
    const { data: user, error: uErr } = await supabase
      .from('users')
      .insert({ station_id: station.id, name: ownerName, email, password_hash: hash, role: 'owner' })
      .select().single();
    if (uErr) throw uErr;

    const token = jwt.sign(
      { userId: user.id, stationId: station.id, role: 'owner' },
      process.env.JWT_SECRET || 'fuelos_secret',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'تم إنشاء حسابك بنجاح',
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      station: { id: station.id, name: station.name }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في الخادم — حاول مرة أخرى' });
  }
};

// تسجيل الدخول
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const { data: user } = await supabase
      .from('users')
      .select('*, stations(id, name, plan, is_active)')
      .eq('email', email)
      .eq('is_active', true)
      .single();

    if (!user) return res.status(401).json({ error: 'البريد أو كلمة المرور غير صحيحة' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'البريد أو كلمة المرور غير صحيحة' });

    const token = jwt.sign(
      { userId: user.id, stationId: user.station_id, role: user.role },
      process.env.JWT_SECRET || 'fuelos_secret',
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      station: user.stations
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
};

// بيانات المستخدم الحالي
const me = async (req, res) => {
  try {
    const { data: user } = await supabase
      .from('users')
      .select('id, name, email, role, stations(id, name, plan, city, country)')
      .eq('id', req.user.userId)
      .single();
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
};

module.exports = { register, login, me };
