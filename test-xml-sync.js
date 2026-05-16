const path = require('path');
// Prioritize local .env.local for Engin Abi
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const { syncGumuskaleXml } = require('./lib/xml_sync_engin');

async function test() {
    console.log("🧪 Manuel XML Sync Testi Başlatılıyor (Engin Abi - xpziispstwarngpsmstd)...");
    const result = await syncGumuskaleXml();
    console.log("Test Sonucu:", result);
}

test();