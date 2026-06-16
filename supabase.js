const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'placeholder';

const supabase = createClient(supabaseUrl, supabaseKey, {
  realtime: {
    enabled: false
  },
  global: {
    headers: {}
  }
});

module.exports = supabase;
