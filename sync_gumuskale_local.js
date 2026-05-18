require('dotenv').config();
const { syncGumuskaleXml } = require('./lib/xml_sync_engin');

async function main() {
    console.log('=================================================');
    console.log('  Gümüşkale XML Sync Başlıyor');
    console.log('=================================================\n');

    const result = await syncGumuskaleXml();

    console.log('\n=================================================');
    console.log('  SYNC TAMAMLANDI');
    console.log('=================================================');
    console.log(JSON.stringify(result, null, 2));
}

main().catch(e => {
    console.error('\n❌ FATAL HATA:', e.message);
    process.exit(1);
});
