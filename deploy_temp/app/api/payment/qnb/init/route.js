import { NextResponse } from 'next/server';
import crypto from 'crypto';

/**
 * QNB FINANSBANK (PAYFOR) - RAW XML & 3DMODEL FIX
 * 'prmstr' zarfı tamamen kaldırıldı. Bankaya Saf XML (Raw) tünelleniyor.
 */

export async function POST(req) {
    try {
        const body = await req.json();
        const { amount, cardHolderName, cardNumber, expireMonth, expireYear, cvv, companyId } = body;

        const MBR_ID = '5';
        const MERCHANT_ID = '104200000015776';
        const USER_CODE = 'B2BSANALPOS';
        const USER_PASS = 'e*Li.82tdAqa#QHrUjZ3N187.wRmPp';
        const TERMINAL_ID = 'V3903841';
        const MERCHANT_PASS = 'btgL!EA0eT40@ajJdmdck2kQUDbLYV';
        
        const PROXY_URL = 'http://34.63.166.56/vpos/XMLGate.aspx';
        const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://b2b.omigroups.com';

        // Sipariş No (QNB + 10 hane)
        const orderId = `QNB${Date.now().toString().slice(-10)}`; 
        const mm = String(expireMonth).padStart(2, '0');
        const yy = String(expireYear).slice(-2);
        const formattedExpiry = `${mm}${yy}`;

        const cleanCard = cardNumber.replace(/\D/g, '');
        const okUrl = `${SITE_URL}/api/payment/qnb/callback?cid=${companyId}`;
        const failUrl = `${SITE_URL}/api/payment/qnb/callback?cid=${companyId}`;
        const rnd = crypto.randomBytes(8).toString('hex').toUpperCase();
        const formattedAmount = parseFloat(amount).toFixed(2);

        // HASH HESAPLAMA (Doküman Sayfa 8 - Birebir)
        const txnType = 'Auth';
        const hashStr = `${MBR_ID}${orderId}${formattedAmount}${okUrl}${failUrl}${txnType}0${rnd}${MERCHANT_PASS}`;
        const hash = crypto.createHash('sha1').update(hashStr).digest('base64');

        // SAF XML PAKETİ
        const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?><VposRequest><MbrId>${MBR_ID}</MbrId><MerchantId>${MERCHANT_ID}</MerchantId><UserCode>${USER_CODE}</UserCode><UserPass>${USER_PASS}</UserPass><TerminalId>${TERMINAL_ID}</TerminalId><OrderId>${orderId}</OrderId><SecureType>3DPay</SecureType><TxnType>${txnType}</TxnType><InstallmentCount>0</InstallmentCount><PurchAmount>${formattedAmount}</PurchAmount><Currency>949</Currency><CardHolderName>${(cardHolderName || 'MUSTERI').substring(0, 50).toUpperCase().replace(/[^A-Z ]/g, ' ')}</CardHolderName><Pan>${cleanCard}</Pan><Expiry>${formattedExpiry}</Expiry><Cvv2>${cvv}</Cvv2><MOTO>0</MOTO><Rnd>${rnd}</Rnd><Hash>${hash}</Hash><Lang>TR</Lang><OkUrl>${okUrl}</OkUrl><FailUrl>${failUrl}</FailUrl></VposRequest>`;

        // BANKAYA GÖNDERİM (Saf Body olarak)
        const response = await fetch(PROXY_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/xml',
                'User-Agent': 'Mozilla/5.0'
            },
            body: xmlPayload
        });

        const responseText = await response.text();
        const lowerRes = responseText.toLowerCase();
        
        // DURUM 1: HAZIR FORM (3DPay)
        if (lowerRes.includes('<form') || lowerRes.includes('action=')) {
            let fixedHtml = responseText.replaceAll('vpos.qnbfinansbank.com', 'vpos.qnb.com.tr').replaceAll('http://', 'https://');
            
            // Script içindeki gerçek form action adresini bul (Bankanın MPI yönlendirmesi)
            const scriptActionMatch = fixedHtml.match(/frm\.action\s*=\s*['"]([^'"]+)['"]/i);
            if (scriptActionMatch) {
                // Formun action adresini script içindeki adres ile değiştir
                fixedHtml = fixedHtml.replace(/action\s*=\s*["'][^"']+["']/i, `action="${scriptActionMatch[1]}"`);
            } else {
                // Script yoksa relative URL'leri düzelt
                const BANK_GATEWAY = 'https://vpos.qnb.com.tr/Gateway/';
                fixedHtml = fixedHtml.replace(/action\s*=\s*["'](?!\s*https?:\/\/)(?:\.\/)?(.*?)["']/gi, `action="${BANK_GATEWAY}$1"`);
            }
            
            return NextResponse.json({ success: true, is3D: true, html: fixedHtml, orderId });
        }

        // DURUM 2: 3DMODEL VERİ PARÇALAMA (PaReq, ACSUrl vb.)
        const paReq = responseText.match(/<PaReq>(.*?)<\/PaReq>/i)?.[1];
        const acsUrl = responseText.match(/<ACSUrl>(.*?)<\/ACSUrl>/i)?.[1];
        const termUrl = responseText.match(/<TermUrl>(.*?)<\/TermUrl>/i)?.[1];
        const md = responseText.match(/<Md>(.*?)<\/Md>/i)?.[1];

        if (paReq && acsUrl) {
            const manualForm = `<html><body onload="document.forms[0].submit()"><form action="${acsUrl}" method="POST"><input type="hidden" name="PaReq" value="${paReq}"><input type="hidden" name="TermUrl" value="${termUrl || okUrl}"><input type="hidden" name="MD" value="${md || ''}"></form></body></html>`;
            return NextResponse.json({ success: true, is3D: true, html: manualForm, orderId });
        }

        // DURUM 3: HATA YAKALAMA
        let bankError = 'Banka Yanıtı Alınamadı';
        const errMatch = responseText.match(/<ErrMsg>(.*?)<\/ErrMsg>/i);
        if (errMatch) bankError = errMatch[1];
        else if (responseText.includes('{')) {
            try {
                const json = JSON.parse(responseText.substring(responseText.indexOf('{')));
                bankError = json.PaymentRequest?.ErrMsg || json.ErrMsg || bankError;
            } catch (e) {}
        } else {
            bankError = `Banka Mesajı: ${responseText.replace(/<[^>]*>/g, '').substring(0, 100)}`;
        }

        return NextResponse.json({ success: false, error: bankError });

    } catch (error) {
        return NextResponse.json({ success: false, error: 'Sistem Hatası: ' + error.message });
    }
}
