-- ============================================
-- FuelOS Database Schema — Supabase/PostgreSQL
-- ============================================

-- STATIONS (المحطات)
CREATE TABLE stations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  phone TEXT,
  city TEXT,
  country TEXT DEFAULT 'MA',
  plan TEXT DEFAULT 'essential' CHECK (plan IN ('essential','complete','enterprise')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- USERS (المستخدمون)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id UUID REFERENCES stations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'cashier' CHECK (role IN ('owner','manager','cashier')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PUMPS (المضخات)
CREATE TABLE pumps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id UUID REFERENCES stations(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  fuel_type TEXT NOT NULL CHECK (fuel_type IN ('gasoline','diesel','premium')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active','maintenance','inactive')),
  last_reading NUMERIC(12,3) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SHIFTS (الوردايات)
CREATE TABLE shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id UUID REFERENCES stations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_time TIMESTAMPTZ,
  opening_cash NUMERIC(10,2) DEFAULT 0,
  closing_cash NUMERIC(10,2),
  status TEXT DEFAULT 'open' CHECK (status IN ('open','closed')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SALES (المبيعات)
CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id UUID REFERENCES stations(id) ON DELETE CASCADE,
  shift_id UUID REFERENCES shifts(id),
  pump_id UUID REFERENCES pumps(id),
  user_id UUID REFERENCES users(id),
  fuel_type TEXT NOT NULL,
  liters NUMERIC(10,3) NOT NULL,
  price_per_liter NUMERIC(8,3) NOT NULL,
  total_amount NUMERIC(10,2) NOT NULL,
  payment_method TEXT DEFAULT 'cash' CHECK (payment_method IN ('cash','card','credit','app')),
  customer_id UUID,
  invoice_number TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- STORE SALES (مبيعات المتجر)
CREATE TABLE store_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id UUID REFERENCES stations(id) ON DELETE CASCADE,
  shift_id UUID REFERENCES shifts(id),
  user_id UUID REFERENCES users(id),
  product_name TEXT NOT NULL,
  category TEXT DEFAULT 'other',
  quantity NUMERIC(10,2) NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  total_amount NUMERIC(10,2) NOT NULL,
  payment_method TEXT DEFAULT 'cash',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- DELIVERIES (التوريد)
CREATE TABLE deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id UUID REFERENCES stations(id) ON DELETE CASCADE,
  fuel_type TEXT NOT NULL,
  invoiced_liters NUMERIC(12,3) NOT NULL,
  actual_liters NUMERIC(12,3),
  difference NUMERIC(12,3) GENERATED ALWAYS AS (actual_liters - invoiced_liters) STORED,
  price_per_liter NUMERIC(8,3),
  total_invoiced NUMERIC(12,2),
  supplier_name TEXT,
  truck_plate TEXT,
  driver_name TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','verified','disputed')),
  alert_sent BOOLEAN DEFAULT false,
  verified_by UUID REFERENCES users(id),
  delivery_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TANKS (الصهاريج)
CREATE TABLE tanks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id UUID REFERENCES stations(id) ON DELETE CASCADE,
  fuel_type TEXT NOT NULL,
  capacity_liters NUMERIC(12,3) NOT NULL,
  current_level NUMERIC(12,3) DEFAULT 0,
  min_level_alert NUMERIC(12,3) DEFAULT 500,
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- DAILY REPORTS (التقارير اليومية)
CREATE TABLE daily_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id UUID REFERENCES stations(id) ON DELETE CASCADE,
  report_date DATE NOT NULL,
  total_fuel_sales NUMERIC(12,2) DEFAULT 0,
  total_store_sales NUMERIC(12,2) DEFAULT 0,
  total_liters_sold NUMERIC(12,3) DEFAULT 0,
  total_cash NUMERIC(12,2) DEFAULT 0,
  total_card NUMERIC(12,2) DEFAULT 0,
  total_credit NUMERIC(12,2) DEFAULT 0,
  shifts_count INTEGER DEFAULT 0,
  transactions_count INTEGER DEFAULT 0,
  gross_revenue NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(station_id, report_date)
);

-- EMPLOYEES (الموظفون التفاصيل)
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  station_id UUID REFERENCES stations(id) ON DELETE CASCADE,
  monthly_salary NUMERIC(10,2),
  hire_date DATE,
  id_number TEXT,
  emergency_contact TEXT,
  total_shifts INTEGER DEFAULT 0,
  total_sales NUMERIC(12,2) DEFAULT 0
);

-- CUSTOMERS (العملاء)
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id UUID REFERENCES stations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  type TEXT DEFAULT 'individual' CHECK (type IN ('individual','company')),
  loyalty_points INTEGER DEFAULT 0,
  credit_balance NUMERIC(10,2) DEFAULT 0,
  credit_limit NUMERIC(10,2) DEFAULT 0,
  total_spent NUMERIC(12,2) DEFAULT 0,
  visits_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- INDEXES للأداء
CREATE INDEX idx_sales_station ON sales(station_id);
CREATE INDEX idx_sales_created ON sales(created_at);
CREATE INDEX idx_sales_shift ON sales(shift_id);
CREATE INDEX idx_shifts_station ON shifts(station_id);
CREATE INDEX idx_deliveries_station ON deliveries(station_id);
CREATE INDEX idx_daily_reports_date ON daily_reports(station_id, report_date);

-- ROW LEVEL SECURITY
ALTER TABLE stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
