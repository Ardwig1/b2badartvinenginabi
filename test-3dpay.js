const crypto = require('crypto');

const MBR_ID = '5';
const MERCHANT_ID = '104200000015776';
const USER_CODE = 'B2BSANALPOS';
const USER_PASS = 'e*Li.82tdAqa#QHruJZ3N187.wRmPp';
const MERCHANT_PASS = 'btgL!EA0eT40@ajJdmdck2kQUDbLYV';
const PROXY_URL = 'http://34.63.166.56/vpos/XMLGate.aspx';

const orderId = `TEST${Date.now().toString().slice(-10)}`;
const amount = '1.00';
const okUrl = 'https://b2b.omigroups.com/api/payment/qnb/callback';
const failUrl = 'https://b2b.omigroups.com/api/payment/qnb/callback';
const rnd = crypto.randomBytes(8).toString('hex').toUpperCase();

// Hash calculation for 3DPay/3DModel: MbrId + OrderId + PurchAmount + OkUrl + FailUrl + TxnType + InstallmentCount + Rnd + MerchantPass
const txnType = 'Auth';
const hashStr = `${MBR_ID}${orderId}${amount}${okUrl}${failUrl}${txnType}0${rnd}${MERCHANT_PASS}`;
const hash = crypto.createHash('sha1').update(hashStr).digest('base64');

const xml = `<?xml version="1.0" encoding="utf-8"?>
<VposRequest>
  <MbrId>${MBR_ID}</MbrId>
  <MerchantId>${MERCHANT_ID}</MerchantId>
  <UserCode>${USER_CODE}</UserCode>
  <UserPass>${USER_PASS}</UserPass>
  <OrderId>${orderId}</OrderId>
  <SecureType>3DPay</SecureType>
  <TxnType>${txnType}</TxnType>
  <InstallmentCount>0</InstallmentCount>
  <PurchAmount>${amount}</PurchAmount>
  <Currency>949</Currency>
  <CardHolderName>TEST NAME</CardHolderName>
  <Pan>4111111111111111</Pan>
  <Expiry>1226</Expiry>
  <Cvv2>123</Cvv2>
  <MOTO>0</MOTO>
  <Lang>TR</Lang>
  <Rnd>${rnd}</Rnd>
  <Hash>${hash}</Hash>
  <OkUrl>${okUrl}</OkUrl>
  <FailUrl>${failUrl}</FailUrl>
</VposRequest>`;

async function test() {
    console.log('Testing QNB 3DPay...');
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
