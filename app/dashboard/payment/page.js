'use client';
import { useState, useEffect, useCallback } from 'react';
import { CreditCardIcon, ArrowLeftIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useCart } from '@/components/CartProvider';
import { calculateCartTotals } from '@/lib/pricing';

export default function PaymentPage() {
    const [amount, setAmount] = useState('');
    const [cardHolderName, setCardHolderName] = useState('');
    const [cardNumber, setCardNumber] = useState('');
    const [expireMonth, setExpireMonth] = useState('');
    const [expireYear, setExpireYear] = useState('');
    const [cvv, setCvv] = useState('');

    const [cartTotal, setCartTotal] = useState(null);
    const [isCartLoading, setIsCartLoading] = useState(false);
    const [isCartChecked, setIsCartChecked] = useState(true);
    const [isDebtChecked, setIsDebtChecked] = useState(false);

    const [loading, setLoading] = useState(false);
    const [isInfoLoading, setIsInfoLoading] = useState(true);
    const [infoError, setInfoError] = useState(null);
    const [toslaData, setToslaData] = useState(null);
    const [buyerInfo, setBuyerInfo] = useState({ email: '', phone: '', companyId: '', companyName: '', currentBalance: 0 });
    const [context, setContext] = useState('');

    const { cartItems } = useCart();
    const [pricingSettings, setPricingSettings] = useState({
        margin: 36,
        usdRate: 0,
        isUsdActive: false,
        rates: { USD: 1, EUR: 1 },
        discountPercent: 0
    });

    const fetchUserAndSettings = useCallback(async () => {
        let backupName = '';
        if (typeof window !== 'undefined') {
            backupName = localStorage.getItem('storedCompanyName') || '';
            if (backupName) {
                setBuyerInfo(prev => ({ ...prev, companyName: backupName }));
                setIsInfoLoading(false);
            }
        }

        try {
            const infoRes = await fetch(`/api/user/info?t=${Date.now()}`, { cache: 'no-store' });
            if (infoRes.ok) {
                const data = await infoRes.json();
                setBuyerInfo({
                    email: data.email || '',
                    phone: data.phone || '',
                    companyId: data.companyId || '',
                    companyName: data.companyName || '',
                    currentBalance: Number(data.currentBalance) || 0
                });
                setPricingSettings(prev => ({ ...prev, discountPercent: Number(data.discountPercent) || 0 }));
            }

            const [marginRes, usdRes, ratesRes] = await Promise.all([
                fetch('/api/admin/margin'),
                fetch('/api/admin/usd-settings'),
                fetch('/api/rates')
            ]);
            
            const [m, u, r] = await Promise.all([marginRes.json(), usdRes.json(), ratesRes.json()]);

            setPricingSettings(prev => ({
                ...prev,
                margin: m?.margin ?? prev.margin,
                usdRate: u?.usd_rate ?? prev.usdRate,
                isUsdActive: u?.is_active ?? prev.isUsdActive,
                rates: r ?? prev.rates
            }));
        } catch (e) {
            console.error(e);
        } finally {
            setIsInfoLoading(false);
        }
    }, []);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const amt = params.get('amount');
            const ctx = params.get('context');
            if (amt) setAmount(amt);
            if (ctx) setContext(ctx);
        }
        fetchUserAndSettings();
    }, [fetchUserAndSettings]);

    // CART CALCULATION LOGIC
    useEffect(() => {
        const items = Object.values(cartItems || {});
        const hasItems = items.some(i => i.qty > 0);
        
        if (hasItems) {
            setIsCartLoading(true);
            const totals = calculateCartTotals(
                cartItems, 
                pricingSettings.discountPercent, 
                pricingSettings.margin, 
                pricingSettings.isUsdActive, 
                pricingSettings.usdRate, 
                pricingSettings.rates
            );
            setCartTotal(totals.grandTotal);
            if ((!amount || amount === '0.00' || context === 'cart') && isCartChecked) {
                setAmount(totals.grandTotal.toFixed(2));
            }
            setIsCartLoading(false);
        } else {
            // Only clear if we are sure there are NO items
            setCartTotal(null);
            setIsCartLoading(false);
        }
    }, [cartItems, pricingSettings, isCartChecked, context, amount]);

    useEffect(() => {
        if (toslaData) document.getElementById("tosla3dForm")?.submit();
    }, [toslaData]);

    const handleCartCheck = (e) => {
        const checked = e.target.checked;
        setIsCartChecked(checked);
        if (checked) {
            setIsDebtChecked(false);
            if (cartTotal) setAmount(parseFloat(cartTotal).toFixed(2));
        } else setAmount('');
    };

    const handleDebtCheck = (e) => {
        const checked = e.target.checked;
        setIsDebtChecked(checked);
        if (checked) {
            setIsCartChecked(false);
            if (buyerInfo?.currentBalance < 0) setAmount(Math.abs(buyerInfo.currentBalance).toFixed(2));
        } else setAmount('');
    };

    const handleAmountChange = (val) => {
        let normalized = val.replace(',', '.').replace(/[^0-9.]/g, '');
        const dots = normalized.split('.');
        if (dots.length > 2) normalized = dots[0] + '.' + dots.slice(1).join('');
        setAmount(normalized);
        setIsCartChecked(false);
        setIsDebtChecked(false);
    };

    const handlePayment = async (e) => {
        e.preventDefault();
        const numericAmount = parseFloat(amount.replace(',', '.'));
        if (isNaN(numericAmount) || numericAmount <= 0) { alert('Lütfen geçerli bir tutar giriniz.'); return; }
        setLoading(true);
        try {
            const res = await fetch('/api/payment/tosla/init', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: numericAmount.toFixed(2),
                    cardHolderName: buyerInfo.companyName || 'MUSTERI',
                    cardNumber: cardNumber.replace(/\s/g, ''),
                    expireMonth, expireYear, cvv,
                    buyerEmail: buyerInfo.email,
                    buyerPhone: buyerInfo.phone,
                    companyId: buyerInfo.companyId,
                    companyName: buyerInfo.companyName,
                    context: context
                })
            });
            const data = await res.json();
            if (res.ok && data.success && data.threeDSessionId) {
                setToslaData({
                    threeDSessionId: data.threeDSessionId,
                    cardHolderName,
                    cardNumber: cardNumber.replace(/\s/g, ''),
                    expireDate: `${String(expireMonth).padStart(2, '0')}/${String(expireYear).slice(-2)}`,
                    cvv, buyerEmail: buyerInfo.email, buyerPhone: buyerInfo.phone,
                    companyName: data.companyName || buyerInfo.companyName || '',
                    processUrl: data.processUrl || 'https://entegrasyon.tosla.com/api/Payment/ProcessCardForm'
                });
            } else alert('Hata: ' + (data.error || 'Bilinmeyen hata'));
        } catch (error) { console.error(error); alert('Hata oluştu.'); } 
        finally { setLoading(false); }
    };

    if (toslaData) {
        let safeName = `${toslaData.companyName || ''}`.trim().replace(/İ/g, 'I').replace(/ı/g, 'i').replace(/Ş/g, 'S').replace(/ş/g, 's').replace(/Ğ/g, 'G').replace(/ğ/g, 'g').replace(/Ü/g, 'U').replace(/ü/g, 'u').replace(/Ö/g, 'O').replace(/ö/g, 'o').replace(/Ç/g, 'C').replace(/ç/g, 'c').replace(/[^a-zA-Z0-9\s]/g, '').trim().toUpperCase();
        return (
            <div className="page-wrapper"><div style={{ padding: 40, textAlign: 'center' }}><h2>Güvenli Ödeme Sayfasına Yönlendiriliyorsunuz...</h2><p>Lütfen bekleyin.</p>
                <form id="tosla3dForm" method="POST" action={toslaData.processUrl} encType="multipart/form-data" style={{ display: 'none' }}>
                    <input type="hidden" name="ThreeDSessionId" value={toslaData.threeDSessionId} /><input type="hidden" name="CardHolderName" value={safeName} /><input type="hidden" name="CardNo" value={toslaData.cardNumber} /><input type="hidden" name="ExpireDate" value={toslaData.expireDate} /><input type="hidden" name="Cvv" value={toslaData.cvv} /><input type="hidden" name="CustomerEmail" value={toslaData.buyerEmail} /><input type="hidden" name="CustomerPhone" value={toslaData.buyerPhone} /><input type="hidden" name="CustomerName" value={safeName} />
                </form>
            </div></div>
        );
    }

    return (
        <div className="page-wrapper">
            <div className="page-header"><div><h1 className="page-title">Online Ödeme (Sanal POS)</h1><p className="page-subtitle">Kredi kartınızla anında bakiye yükleyin veya fatura ödeyin</p></div></div>

            <div style={{ display: 'flex', gap: 24, maxWidth: 900, margin: '0 auto', alignItems: 'stretch', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 500px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {/* Tosla & Akbank Info Banner */}
                    <div style={{
                        padding: '24px 30px',
                        background: 'linear-gradient(90deg, rgba(227, 24, 55, 0.12) 0%, rgba(227, 24, 55, 0.03) 100%)',
                        border: '1px solid rgba(227, 24, 55, 0.25)',
                        borderRadius: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '20px',
                        color: 'var(--text-primary)',
                        boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', minWidth: '100px' }}>
                            <img 
                                src="https://www.akbank.com/Content/img/akbank-logo.png" 
                                alt="Akbank" 
                                style={{ height: '32px', width: 'auto', objectFit: 'contain' }} 
                                onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                            />
                            <div style={{ display: 'none', background: '#e31837', color: 'white', padding: '4px 12px', borderRadius: '4px', fontWeight: 900, fontSize: '18px', fontFamily: 'Arial, sans-serif', letterSpacing: '-1px' }}>AKBANK</div>
                        </div>
                        <div style={{ fontSize: '16px', fontWeight: 500, lineHeight: '1.4' }}>
                            <strong style={{ color: '#e31837', fontWeight: 800 }}>TOSLA</strong> altyapısı ile güvenli ödeme yapıyorsunuz. 
                            <br/>
                            <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Tosla, bir <strong>AKBANK</strong> ödeme yöntemidir.</span>
                        </div>
                        <div style={{ marginLeft: 'auto', background: '#10b981', color: 'white', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <ShieldCheckIcon style={{ width: 16, height: 16 }} />
                            GÜVENLİ
                        </div>
                    </div>

                    {/* Main Payment Card */}
                    <div className="card" style={{ padding: 30 }}>
                        <h2 style={{ marginBottom: 20, fontSize: 18, fontWeight: 700 }}>Ödeme Bilgileri</h2>
                        <form onSubmit={handlePayment}>
                            <div className="form-group" style={{ marginBottom: 20 }}>
                                <label className="form-label">{context === 'cart' ? 'Sepet Tutarı (Değiştirilemez)' : 'Ödenecek Tutar (₺)'}</label>
                                <input type="text" inputMode="decimal" className="form-input" style={{ fontSize: 24, padding: '12px 16px', fontWeight: 'bold', color: 'var(--primary)' }} value={amount} onChange={e => handleAmountChange(e.target.value)} placeholder="0.00" disabled={context === 'cart' || (isCartChecked && cartTotal !== null) || isDebtChecked} required />
                                <small style={{ color: '#6c757d', display: 'block', marginTop: 4 }}>{amount.includes(',') || amount.includes('.') ? 'Ondalık ayracı otomatik olarak ayarlanır.' : 'Virgül (,) veya Nokta (.) kullanabilirsiniz.'}</small>
                            </div>

                            <div className="form-group" style={{ marginBottom: 15 }}>
                                <label className="form-label">İşlem Yapan Firma (Referans)</label>
                                <div style={{ position: 'relative' }}>
                                    <input type="text" className="form-input" value={infoError ? 'Hata oluştu!' : (buyerInfo.companyName || (isInfoLoading ? 'Yükleniyor...' : 'FİRMA BİLGİSİ EKSİK!'))} disabled style={{ backgroundColor: infoError || (!isInfoLoading && !buyerInfo.companyName) ? '#fff1f2' : '#f8f9fa', cursor: 'not-allowed', color: infoError || (!isInfoLoading && !buyerInfo.companyName) ? '#dc2626' : (isInfoLoading ? '#6c757d' : '#1e293b'), fontWeight: 'bold', border: infoError || (!isInfoLoading && !buyerInfo.companyName) ? '1px solid #fda4af' : '1px solid var(--border)' }} />
                                    {isInfoLoading && <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }}><div className="loading-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /></div>}
                                </div>
                                <small style={{ color: infoError ? '#dc2626' : '#6c757d', marginTop: 4, display: 'block' }}>Güvenlik gereği sadece firma adınız Tosla'ya iletilir.</small>
                            </div>

                            <div className="form-group" style={{ marginBottom: 15 }}><label className="form-label">Kredi Kartı Numarası</label><input type="text" className="form-input" value={cardNumber} onChange={e => { let val = e.target.value.replace(/\D/g, ''); let parts = val.match(/.{1,4}/g); setCardNumber(parts ? parts.join(' ') : val); }} placeholder="0000 0000 0000 0000" maxLength="19" required /></div>

                            <div style={{ display: 'flex', gap: 15, marginBottom: 20 }}>
                                <div className="form-group" style={{ flex: 1 }}><label className="form-label">Ay</label><input type="text" className="form-input" value={expireMonth} onChange={e => setExpireMonth(e.target.value.replace(/\D/g, ''))} placeholder="AA" maxLength="2" required /></div>
                                <div className="form-group" style={{ flex: 1 }}><label className="form-label">Yıl</label><input type="text" className="form-input" value={expireYear} onChange={e => setExpireYear(e.target.value.replace(/\D/g, ''))} placeholder="YY" maxLength="2" required /></div>
                                <div className="form-group" style={{ flex: 1 }}><label className="form-label">CVV</label><input type="password" placeholder="***" className="form-input" value={cvv} onChange={e => setCvv(e.target.value.replace(/\D/g, ''))} maxLength="4" required /></div>
                            </div>

                            <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 10, opacity: (loading || isInfoLoading || infoError || !buyerInfo.companyName) ? 0.6 : 1 }} disabled={loading || isInfoLoading || infoError || !buyerInfo.companyName}>{loading ? <><div className="loading-spinner" style={{ width: 18, height: 18, borderTopColor: 'white' }} /> İşleniyor...</> : <><CreditCardIcon style={{ width: 20, height: 20 }} /> Güvenli Ödeme Yap (Tosla)</>}</button>
                        </form>

                        <div style={{ marginTop: 24, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '24px', padding: '16px 24px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', marginBottom: '20px' }}>
                                <img src="/user_logo3.png" alt="Troy" style={{ height: 32, width: 'auto', objectFit: 'contain' }} />
                                <img src="/user_logo2.png" alt="Visa" style={{ height: 24, width: 'auto', objectFit: 'contain' }} />
                                <img src="/user_logo1.png" alt="Mastercard" style={{ height: 32, width: 'auto', objectFit: 'contain' }} />
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '24px', borderLeft: '1px solid rgba(255, 255, 255, 0.1)', height: '32px' }}>
                                    <div style={{ width: 28, height: 28, background: '#10b981', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg></div>
                                    <div style={{ textAlign: 'left', lineHeight: '1.2' }}><div style={{ fontSize: '10px', fontWeight: 700, color: '#10b981', letterSpacing: '0.5px' }}>256 BIT SSL</div><div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)' }}>GÜVENLİ ÖDEME</div></div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}><Link href="/mesafeli-satis-sozlesmesi" target="_blank" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>Mesafeli Satış Sözleşmesi</Link><span style={{ color: 'var(--border)' }}>|</span><Link href="/iptal-ve-iade-kosullari" target="_blank" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>İptal ve İade Koşulları</Link><span style={{ color: 'var(--border)' }}>|</span><Link href="/gizlilik-ve-guvenlik" target="_blank" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>Gizlilik Politikası</Link></div>
                        </div>
                    </div>
                </div>

                <div style={{ flex: '0 0 320px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {(cartTotal !== null || isCartLoading) && (
                        <div className="card" style={{ padding: 24, border: isCartChecked ? '2px solid var(--primary)' : '1px solid var(--border)', opacity: (isDebtChecked || isCartLoading) ? 0.6 : 1, cursor: isCartLoading ? 'wait' : 'pointer' }} onClick={() => !isCartChecked && !isCartLoading && handleCartCheck({ target: { checked: true } })}>
                            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: isCartChecked ? 'var(--primary)' : 'inherit' }}>Sepet Ödemesi</h3>
                            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16, marginBottom: 16, minHeight: 64, display: 'flex', alignItems: 'center' }}>
                                {isCartLoading ? <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><div className="loading-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /><span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Hesaplanıyor...</span></div> : <div><div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Ödenecek Tutar:</div><div style={{ fontSize: 20, fontWeight: 800, color: 'var(--primary)' }}>₺{parseFloat(cartTotal || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</div></div>}
                            </div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: isCartLoading ? 'wait' : 'pointer' }}><input type="checkbox" checked={isCartChecked} onChange={handleCartCheck} disabled={isCartLoading} style={{ width: 20, height: 20 }} /><span style={{ fontWeight: 600, fontSize: 14 }}>Bu tutarı öde</span></label>
                        </div>
                    )}

                    {!isInfoLoading && (buyerInfo.currentBalance < 0 || isInfoLoading) && (
                        <div className="card" style={{ padding: 24, border: isDebtChecked ? '2px solid var(--danger)' : '1px solid var(--border)', opacity: isCartChecked ? 0.6 : 1, cursor: 'pointer' }} onClick={() => !isDebtChecked && handleDebtCheck({ target: { checked: true } })}>
                            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: isDebtChecked ? 'var(--danger)' : 'inherit' }}>Cari Borç Ödemesi</h3>
                            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16, marginBottom: 16 }}>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Güncel Cari Borcunuz:</div>
                                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--danger)' }}>₺{Math.abs(buyerInfo.currentBalance).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</div>
                            </div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}><input type="checkbox" checked={isDebtChecked} onChange={handleDebtCheck} style={{ width: 20, height: 20 }} /><span style={{ fontWeight: 600, fontSize: 14 }}>Tüm borcumu öde</span></label>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
