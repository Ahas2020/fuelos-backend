const supabase = require('../config/supabase');

// تسجيل توريد جديد
const createDelivery = async (req, res) => {
  try {
    const {
      fuel_type, invoiced_liters, actual_liters,
      price_per_liter, supplier_name, truck_plate, driver_name
    } = req.body;
    const { stationId, userId } = req.user;

    const invoiced = Number(invoiced_liters);
    const actual = Number(actual_liters);
    const diff = actual - invoiced;
    const total_invoiced = invoiced * Number(price_per_liter || 0);

    // تحديد الحالة
    const status = Math.abs(diff) < 5 ? 'verified' :
                   diff < 0 ? 'disputed' : 'verified';

    const alert_sent = diff < -10; // تنبيه إذا النقص أكثر من 10 لترات

    const { data: delivery, error } = await supabase
      .from('deliveries')
      .insert({
        station_id: stationId,
        fuel_type, invoiced_liters: invoiced,
        actual_liters: actual, price_per_liter,
        total_invoiced, supplier_name, truck_plate,
        driver_name, status, alert_sent,
        verified_by: userId
      })
      .select().single();
    if (error) throw error;

    // تحديث مستوى الصهريج
    if (actual > 0) {
      await supabase.from('tanks')
        .update({
          current_level: supabase.rpc('increment', { x: actual }),
          last_updated: new Date().toISOString()
        })
        .eq('station_id', stationId)
        .eq('fuel_type', fuel_type)
        .catch(() => {});
    }

    // بناء تقرير الشحنة
    const report = buildDeliveryReport(delivery, diff, total_invoiced);

    res.status(201).json({
      delivery,
      report,
      alert: diff < -10 ? {
        type: 'SHORTAGE',
        message: `⚠️ نقص ${Math.abs(diff).toFixed(1)} لتر في شحنة ${fuel_type}`,
        financial_loss: Number((Math.abs(diff) * Number(price_per_liter || 0)).toFixed(2))
      } : null
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في تسجيل التوريد' });
  }
};

// بناء تقرير الشحنة
const buildDeliveryReport = (delivery, diff, total_invoiced) => {
  const status = diff < -10 ? '🚨 نقص مكتشف' :
                 diff < 0 ? '⚠️ فجوة بسيطة' :
                 diff > 10 ? '✅ فائض' : '✅ مطابق';

  return {
    title: `تقرير توريد — ${delivery.fuel_type}`,
    date: new Date().toLocaleDateString('ar-MA'),
    invoiced: delivery.invoiced_liters,
    actual: delivery.actual_liters,
    difference: diff.toFixed(1),
    difference_percent: ((diff / delivery.invoiced_liters) * 100).toFixed(2),
    financial_impact: Number((diff * (delivery.price_per_liter || 0)).toFixed(2)),
    status,
    recommendation: diff < -10
      ? 'يُنصح بمراسلة المورد فوراً بهذا التقرير للمطالبة بالتعويض'
      : 'الشحنة في حدود القبول المعتاد'
  };
};

// سجل التوريدات
const getDeliveries = async (req, res) => {
  try {
    const { stationId } = req.user;
    const { from, to, status, fuel_type } = req.query;

    let query = supabase.from('deliveries').select('*')
      .eq('station_id', stationId)
      .order('delivery_date', { ascending: false });

    if (from) query = query.gte('delivery_date', `${from}T00:00:00`);
    if (to) query = query.lte('delivery_date', `${to}T23:59:59`);
    if (status) query = query.eq('status', status);
    if (fuel_type) query = query.eq('fuel_type', fuel_type);

    const { data, error } = await query.limit(100);
    if (error) throw error;

    // إحصائيات
    const totalShortage = data
      .filter(d => d.difference < 0)
      .reduce((s, d) => s + Math.abs(Number(d.difference)), 0);

    const financialLoss = data
      .filter(d => d.difference < 0)
      .reduce((s, d) => s + Math.abs(Number(d.difference)) * Number(d.price_per_liter || 0), 0);

    res.json({
      deliveries: data,
      stats: {
        total: data.length,
        disputed: data.filter(d => d.status === 'disputed').length,
        verified: data.filter(d => d.status === 'verified').length,
        total_shortage_liters: Number(totalShortage.toFixed(1)),
        total_financial_loss: Number(financialLoss.toFixed(2))
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في جلب سجل التوريدات' });
  }
};

// ملخص نقص التوريد للمالك
const getShortageAlert = async (req, res) => {
  try {
    const { stationId } = req.user;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data } = await supabase
      .from('deliveries').select('*')
      .eq('station_id', stationId)
      .lt('difference', -5)
      .gte('delivery_date', thirtyDaysAgo);

    const totalLoss = data?.reduce((s, d) =>
      s + Math.abs(Number(d.difference)) * Number(d.price_per_liter || 1.2), 0) || 0;

    res.json({
      period: '30 يوماً',
      shortage_events: data?.length || 0,
      total_liters_lost: data?.reduce((s, d) => s + Math.abs(Number(d.difference)), 0).toFixed(1) || 0,
      total_financial_loss: Number(totalLoss.toFixed(2)),
      message: totalLoss > 0
        ? `⚠️ خسرت ${totalLoss.toFixed(0)} درهم في 30 يوماً بسبب نقص التوريد`
        : '✅ لا نقص مكتشف في آخر 30 يوماً'
    });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في جلب تنبيهات النقص' });
  }
};

module.exports = { createDelivery, getDeliveries, getShortageAlert };
