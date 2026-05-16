const { createClient } = require('@supabase/supabase-js');
const { syncGumuskaleXml } = require('./xml_sync_engin');

/**
 * Failsafe Internal Trigger
 * This checks if the sync has already run today. If not, it triggers it.
 */
async function checkAndTriggerSync() {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const today = new Date().toISOString().split('T')[0];

    try {
        // 1. Check DB for today's sync
        const { data, error } = await supabase
            .from('site_settings')
            .select('setting_value')
            .eq('setting_key', 'last_xml_sync')
            .single();

        if (error && error.code !== 'PGRST116') throw error;

        const lastSyncDate = data?.setting_value?.date;

        if (lastSyncDate !== today) {
            console.log(`🛡️ [Internal Sync] Today (${today}) hasn't been synced. Starting...`);
            // Update status immediately to "running" to prevent race conditions from multiple users
            await supabase.from('site_settings').upsert({
                setting_key: 'last_xml_sync',
                setting_value: { date: today, status: 'running' }
            });

            await syncGumuskaleXml();
        } else {
            // console.log(`✅ [Internal Sync] Already synced today (${today}).`);
        }
    } catch (e) {
        console.error("🛡️ [Internal Sync Error]:", e.message);
    }
}

module.exports = { checkAndTriggerSync };
