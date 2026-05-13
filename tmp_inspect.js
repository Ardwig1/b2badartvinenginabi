import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://xpziispstwarngpsmstd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhwemlpc3BzdHdhcm5ncHNtc3RkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1Mjg3ODcsImV4cCI6MjA5NDEwNDc4N30.hZ-YINcJNCfgumnLj0z_u_Kt_7gA6vcnpX8FgxsswwQ');

async function inspect() {
    try {
        const { data: comp, error: cErr } = await supabase.from('companies').select('*').limit(1);
        const { data: ord, error: oErr } = await supabase.from('orders').select('*').limit(1);
        if (cErr) console.error('CERR:', cErr);
        if (oErr) console.error('OERR:', oErr);
        console.log('COMPANY COLS:', Object.keys(comp?.[0] || {}));
        console.log('ORDER COLS:', Object.keys(ord?.[0] || {}));
    } catch (e) {
        console.error('EX:', e);
    }
}
inspect();
