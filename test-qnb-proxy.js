
const MBR_ID = '5';
const MERCHANT_ID = '104200000015776';
const USER_CODE = 'B2BSANALPOS';
const USER_PASS = 'e*Li.82tdAqa#QHruJZ3N187.wRmPp';
const PROXY_URL = 'http://34.63.166.56/vpos/XmlGate.aspx';

const xml = `<?xml version="1.0" encoding="utf-8"?>
<VposRequest>
  <MbrId>${MBR_ID}</MbrId>
  <MerchantId>${MERCHANT_ID}</MerchantId>
  <UserCode>${USER_CODE}</UserCode>
  <UserPass>${USER_PASS}</UserPass>
  <OrderId>TEST${Date.now()}</OrderId>
  <SecureType>3DPay</SecureType>
  <TxnType>Auth</TxnType>
  <InstallmentCount>0</InstallmentCount>
  <PurchAmount>1.00</PurchAmount>
  <Currency>949</Currency>
  <CardHolderName>TEST NAME</CardHolderName>
  <Pan>4111111111111111</Pan>
  <Expiry>1226</Expiry>
  <Cvv2>123</Cvv2>
  <MOTO>0</MOTO>
  <Lang>TR</Lang>
  <OkUrl>https://b2b.artpar.com/api/payment/qnb/callback</OkUrl>
  <FailUrl>https://b2b.artpar.com/api/payment/qnb/callback</FailUrl>
</VposRequest>`;

async function test() {
    console.log('Testing QNB Proxy Simplified XML...');
    try {
        const res = await fetch(PROXY_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/xml',
                'User-Agent': 'Mozilla/5.0'
            },
            body: xml
        });
        const text = await res.text();
        console.log('Response status:', res.status);
        console.log('Response content:', text);
    } catch (e) {
        console.error('Error:', e);
    }
}

test();
