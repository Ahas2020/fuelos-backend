const supabase = require('./supabase');

const getDashboard = async (req, res) => {
  try {
    const { stationId } = req.user;
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const monthStart = today.substring(0, 7) + '-01';

    // كل البيانات بالتوازي
    const [
      todaySales, yesterdaySales,
      monthSales, openShifts,
      tanks, recentDeliveries,
      pumps, recentSales
    ] = await Promise.all([
      supabase.from('sales').select('total_amount,liters,payment_method')
        .eq('station_id', stationId).gte('created_at', `${today}T00:00:00`),
      supabase.from('sales').select('total_amount')
        .eq('station_id', stationId)
        .gte('created_at', `${yesterday}T00:00:00`)
        .lte('created_at', `${yesterday}T23:59:59`),
      supabase.from('sales').select('total_amount')
        .eq('station_id', stationId).gte('created_at', `${monthStart}T00:00:00`),
      supabase.from('shifts').select('id,user_id,start_time,users(name)')
        .eq('station_id', stationId).eq('status', 'open'),
      supabase.from('tanks').select('*').eq('station_id', stationId),
      supabase.from('deliveries').select('*')
        .eq('station_id', stationId).order('delivery_date', { ascending: false }).limit(5),
      supabase.from('pumps').select('*').eq('station_id', stationId),
      supabase.from('sales').select('*, pumps(number)')
        .eq('station_id', stationId).order('created_at', { ascending: false }).limit(10)
    ]);

    const todayTotal = todaySales.data?.reduce((s, x) => s + Number(x.total_amount), 0) || 0;
    const yesterdayTotal = yesterdaySales.data?.reduce((s, x) => s + Number(x.total_amount), 0) || 0;
    const monthTotal = monthSales.data?.reduce((s, x) => s + Number(x.total_amount), 0) || 0;
    const todayLiters = todaySales.data?.reduce((s, x) => s + Number(x.liters), 0) || 0;

    const growthPercent = yesterdayTotal > 0
      ? Number((((todayTotal - yesterdayTotal) / yesterdayTotal) * 100).toFixed(1))
      : 0;

    // تنبيهات الصهاريج
    const tankAlerts = (tanks.data || []).filter(t =>
      Number(t.current_level) <= Number(t.min_level_alert)
    );

    // تنبيهات نقص التوريد الأخير
    const shortageAlerts = (recentDeliveries.data || []).filter(d =>
      Number(d.difference) < -10
    );

    res.json({
      today: {
        total_sales: Number(todayTotal.toFixed(2)),
        total_liters: Number(todayLiters.toFixed(1)),
        transactions: todaySales.data?.length || 0,
        growth_vs_yesterday: growthPercent
      },
      month: {
        total_sales: Number(monthTotal.toFixed(2)),
        days_elapsed: new Date().getDate()
      },
      operations: {
        open_shifts: openShifts.data?.length || 0,
        active_pumps: (pumps.data || []).filter(p => p.status === 'active').length,
        total_pumps: pumps.data?.length || 0,
        shifts_detail: openShifts.data || []
      },
      tanks: (tanks.data || []).map(t => ({
        ...t,
        level_percent: Number(((t.current_level / t.capacity_liters) * 100).toFixed(1)),
        status: t.current_level <= t.min_level_alert ? 'low' :
                t.current_level <= t.min_level_alert * 2 ? 'medium' : 'good'
      })),
      alerts: {
        tank_alerts: tankAlerts.map(t => ({
          type: 'LOW_TANK',
          message: `⛽ صهريج ${t.fuel_type} منخفض — ${t.current_level}L متبقي`,
          urgency: 'high'
        })),
        shortage_alerts: shortageAlerts.map(d => ({
          type: 'DELIVERY_SHORTAGE',
          message: `🚨 نقص ${Math.abs(Number(d.difference)).toFixed(0)}L في آخر شحنة ${d.fuel_type}`,
          urgency: 'critical'
        }))
      },
      recent_deliveries: recentDeliveries.data || [],
      recent_sales: recentSales.data || [],
      pumps: pumps.data || []
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في جلب بيانات لوحة التحكم' });
  }
};

// تقرير يومي مفصل
const getDailyReport = async (req, res) => {
  try {
    const { stationId } = req.user;
    const { date } = req.query;
    const reportDate = date || new Date().toISOString().split('T')[0];

    const [fuel, store, shifts, deliveries] = await Promise.all([
      supabase.from('sales').select('*, users(name), pumps(number)')
        .eq('station_id', stationId)
        .gte('created_at', `${reportDate}T00:00:00`)
        .lte('created_at', `${reportDate}T23:59:59`)
        .order('created_at'),
      supabase.from('store_sales').select('*, users(name)')
        .eq('station_id', stationId)
        .gte('created_at', `${reportDate}T00:00:00`)
        .lte('created_at', `${reportDate}T23:59:59`),
      supabase.from('shifts').select('*, users(name)')
        .eq('station_id', stationId)
        .gte('created_at', `${reportDate}T00:00:00`),
      supabase.from('deliveries').select('*')
        .eq('station_id', stationId)
        .gte('delivery_date', `${reportDate}T00:00:00`)
        .lte('delivery_date', `${reportDate}T23:59:59`)
    ]);

    const fuelTotal = fuel.data?.reduce((s, x) => s + Number(x.total_amount), 0) || 0;
    const storeTotal = store.data?.reduce((s, x) => s + Number(x.total_amount), 0) || 0;
    const totalLiters = fuel.data?.reduce((s, x) => s + Number(x.liters), 0) || 0;

    res.json({
      date: reportDate,
      station_id: stationId,
      summary: {
        fuel_revenue: Number(fuelTotal.toFixed(2)),
        store_revenue: Number(storeTotal.toFixed(2)),
        total_revenue: Number((fuelTotal + storeTotal).toFixed(2)),
        total_liters: Number(totalLiters.toFixed(3)),
        fuel_transactions: fuel.data?.length || 0,
        store_transactions: store.data?.length || 0
      },
      payment_breakdown: {
        cash: fuel.data?.filter(s => s.payment_method === 'cash')
          .reduce((s, x) => s + Number(x.total_amount), 0) || 0,
        card: fuel.data?.filter(s => s.payment_method === 'card')
          .reduce((s, x) => s + Number(x.total_amount), 0) || 0,
        credit: fuel.data?.filter(s => s.payment_method === 'credit')
          .reduce((s, x) => s + Number(x.total_amount), 0) || 0
      },
      by_fuel_type: fuel.data?.reduce((acc, s) => {
        if (!acc[s.fuel_type]) acc[s.fuel_type] = { amount: 0, liters: 0 };
        acc[s.fuel_type].amount += Number(s.total_amount);
        acc[s.fuel_type].liters += Number(s.liters);
        return acc;
      }, {}) || {},
      shifts: shifts.data || [],
      deliveries: deliveries.data || [],
      all_sales: fuel.data || [],
      store_sales: store.data || []
    });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في جلب التقرير اليومي' });
  }
};

module.exports = { getDashboard, getDailyReport };
