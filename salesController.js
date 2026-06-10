const supabase = require('../config/supabase');

// إنشاء وردية جديدة
const openShift = async (req, res) => {
  try {
    const { opening_cash = 0, notes } = req.body;
    const { stationId, userId } = req.user;

    // هل هناك وردية مفتوحة؟
    const { data: open } = await supabase
      .from('shifts')
      .select('id')
      .eq('station_id', stationId)
      .eq('user_id', userId)
      .eq('status', 'open')
      .single();
    if (open) return res.status(400).json({ error: 'لديك وردية مفتوحة بالفعل' });

    const { data: shift, error } = await supabase
      .from('shifts')
      .insert({ station_id: stationId, user_id: userId, opening_cash, notes })
      .select().single();
    if (error) throw error;

    res.status(201).json({ message: 'تم فتح الوردية', shift });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في فتح الوردية' });
  }
};

// إغلاق الوردية
const closeShift = async (req, res) => {
  try {
    const { shift_id, closing_cash, notes } = req.body;
    const { stationId } = req.user;

    // حساب إجماليات الوردية
    const { data: sales } = await supabase
      .from('sales')
      .select('total_amount, payment_method')
      .eq('shift_id', shift_id)
      .eq('station_id', stationId);

    const { data: storeSales } = await supabase
      .from('store_sales')
      .select('total_amount')
      .eq('shift_id', shift_id);

    const fuelTotal = sales?.reduce((s, x) => s + Number(x.total_amount), 0) || 0;
    const storeTotal = storeSales?.reduce((s, x) => s + Number(x.total_amount), 0) || 0;

    const { data: shift, error } = await supabase
      .from('shifts')
      .update({
        end_time: new Date().toISOString(),
        closing_cash,
        status: 'closed',
        notes
      })
      .eq('id', shift_id)
      .eq('station_id', stationId)
      .select().single();
    if (error) throw error;

    res.json({
      message: 'تم إغلاق الوردية بنجاح',
      shift,
      summary: {
        fuel_total: fuelTotal,
        store_total: storeTotal,
        grand_total: fuelTotal + storeTotal,
        transactions: sales?.length || 0
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في إغلاق الوردية' });
  }
};

// تسجيل بيعة وقود
const recordSale = async (req, res) => {
  try {
    const { pump_id, fuel_type, liters, price_per_liter, payment_method, customer_id } = req.body;
    const { stationId, userId } = req.user;

    // الوردية المفتوحة
    const { data: shift } = await supabase
      .from('shifts')
      .select('id')
      .eq('station_id', stationId)
      .eq('user_id', userId)
      .eq('status', 'open')
      .single();
    if (!shift) return res.status(400).json({ error: 'لا توجد وردية مفتوحة — افتح وردية أولاً' });

    const total_amount = Number((liters * price_per_liter).toFixed(2));
    const invoice_number = `INV-${Date.now()}`;

    const { data: sale, error } = await supabase
      .from('sales')
      .insert({
        station_id: stationId,
        shift_id: shift.id,
        pump_id,
        user_id: userId,
        fuel_type,
        liters: Number(liters),
        price_per_liter: Number(price_per_liter),
        total_amount,
        payment_method: payment_method || 'cash',
        customer_id,
        invoice_number
      })
      .select().single();
    if (error) throw error;

    // تحديث مستوى الصهريج
    await supabase.rpc('decrease_tank_level', {
      p_station_id: stationId,
      p_fuel_type: fuel_type,
      p_liters: Number(liters)
    }).catch(() => {}); // لا يوقف العملية إن لم تكن RPC موجودة

    res.status(201).json({
      message: 'تم تسجيل البيعة',
      sale,
      invoice: { number: invoice_number, total: total_amount }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في تسجيل البيعة' });
  }
};

// تسجيل بيعة متجر
const recordStoreSale = async (req, res) => {
  try {
    const { product_name, category, quantity, unit_price, payment_method } = req.body;
    const { stationId, userId } = req.user;

    const { data: shift } = await supabase
      .from('shifts').select('id')
      .eq('station_id', stationId).eq('user_id', userId).eq('status', 'open').single();
    if (!shift) return res.status(400).json({ error: 'لا توجد وردية مفتوحة' });

    const total_amount = Number((quantity * unit_price).toFixed(2));

    const { data: sale, error } = await supabase
      .from('store_sales')
      .insert({
        station_id: stationId, shift_id: shift.id, user_id: userId,
        product_name, category: category || 'other',
        quantity: Number(quantity), unit_price: Number(unit_price),
        total_amount, payment_method: payment_method || 'cash'
      })
      .select().single();
    if (error) throw error;

    res.status(201).json({ message: 'تم تسجيل مبيعة المتجر', sale });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في تسجيل المبيعة' });
  }
};

// مبيعات اليوم
const getTodaySales = async (req, res) => {
  try {
    const { stationId } = req.user;
    const today = new Date().toISOString().split('T')[0];

    const [fuelRes, storeRes, shiftsRes] = await Promise.all([
      supabase.from('sales').select('*')
        .eq('station_id', stationId)
        .gte('created_at', `${today}T00:00:00`)
        .lte('created_at', `${today}T23:59:59`),
      supabase.from('store_sales').select('*')
        .eq('station_id', stationId)
        .gte('created_at', `${today}T00:00:00`)
        .lte('created_at', `${today}T23:59:59`),
      supabase.from('shifts').select('*, users(name)')
        .eq('station_id', stationId)
        .gte('created_at', `${today}T00:00:00`)
    ]);

    const fuelSales = fuelRes.data || [];
    const storeSales = storeRes.data || [];

    const fuelTotal = fuelSales.reduce((s, x) => s + Number(x.total_amount), 0);
    const storeTotal = storeSales.reduce((s, x) => s + Number(x.total_amount), 0);
    const totalLiters = fuelSales.reduce((s, x) => s + Number(x.liters), 0);

    // مبيعات حسب نوع الوقود
    const byFuelType = fuelSales.reduce((acc, s) => {
      acc[s.fuel_type] = (acc[s.fuel_type] || 0) + Number(s.total_amount);
      return acc;
    }, {});

    // مبيعات حسب طريقة الدفع
    const byPayment = fuelSales.reduce((acc, s) => {
      acc[s.payment_method] = (acc[s.payment_method] || 0) + Number(s.total_amount);
      return acc;
    }, {});

    res.json({
      date: today,
      summary: {
        fuel_total: Number(fuelTotal.toFixed(2)),
        store_total: Number(storeTotal.toFixed(2)),
        grand_total: Number((fuelTotal + storeTotal).toFixed(2)),
        total_liters: Number(totalLiters.toFixed(3)),
        transactions_count: fuelSales.length + storeSales.length
      },
      by_fuel_type: byFuelType,
      by_payment: byPayment,
      shifts: shiftsRes.data || [],
      recent_sales: fuelSales.slice(-10).reverse()
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في جلب مبيعات اليوم' });
  }
};

// تقرير فترة زمنية
const getSalesReport = async (req, res) => {
  try {
    const { stationId } = req.user;
    const { from, to } = req.query;

    const { data: sales } = await supabase
      .from('sales').select('*')
      .eq('station_id', stationId)
      .gte('created_at', `${from}T00:00:00`)
      .lte('created_at', `${to}T23:59:59`)
      .order('created_at', { ascending: false });

    const { data: store } = await supabase
      .from('store_sales').select('*')
      .eq('station_id', stationId)
      .gte('created_at', `${from}T00:00:00`)
      .lte('created_at', `${to}T23:59:59`);

    const fuelTotal = sales?.reduce((s, x) => s + Number(x.total_amount), 0) || 0;
    const storeTotal = store?.reduce((s, x) => s + Number(x.total_amount), 0) || 0;

    res.json({
      period: { from, to },
      summary: {
        fuel_total: Number(fuelTotal.toFixed(2)),
        store_total: Number(storeTotal.toFixed(2)),
        grand_total: Number((fuelTotal + storeTotal).toFixed(2)),
        total_transactions: (sales?.length || 0) + (store?.length || 0)
      },
      sales: sales || [],
      store_sales: store || []
    });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في جلب التقرير' });
  }
};

module.exports = { openShift, closeShift, recordSale, recordStoreSale, getTodaySales, getSalesReport };
