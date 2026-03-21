'use client';
import { useState, useEffect } from 'react';
import { CreditCardIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function PaymentPage() {
    const [amount, setAmount] = useState('');
    const [cardHolderName, setCardHolderName] = useState('');
    const [cardNumber, setCardNumber] = useState('');
    const [expireMonth, setExpireMonth] = useState('');
    const [expireYear, setExpireYear] = useState('');
    const [cvv, setCvv] = useState('');
    
    const [cartTotal, setCartTotal] = useState(null);
    const [isCartChecked, setIsCartChecked] = useState(false);
    const [isDebtChecked, setIsDebtChecked] = useState(false);

    const [loading, setLoading] = useState(false);
    const [threeDHtml, setThreeDHtml] = useState(null);
    const [buyerInfo, setBuyerInfo] = useState({ currentBalance: 0 });

    useEffect(() => {
        // Recover cart total and auto-select if applicable
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const amt = params.get('amount');
            if (amt) setAmount(amt);

            const cTot = sessionStorage.getItem('pendingCartTotal');
            if (cTot) {
                setCartTotal(cTot);
                if (!amt) {
                    setIsCartChecked(true);
                    setAmount(parseFloat(cTot).toFixed(2));
                }
            }
        }

        const fetchUser = async () => {
            try {
                const res = await fetch('/api/user/info', { cache: 'no-store' });
                if (res.ok) {
                    const data = await res.json();
                    setBuyerInfo({
                        currentBalance: Number(data.currentBalance) || 0
                    });
                }
            } catch (err) {
                console.error('Error fetching user info:', err);
            }
        };

        fetchUser();
    }, []);

    const handleCartCheck = (e) => {
        const checked = e.target.checked;
        setIsCartChecked(checked);
        setIsDebtChecked(false);
        if (checked && cartTotal) {
            setAmount(parseFloat(cartTotal).toFixed(2));
        } else if (!checked) {
            setAmount('');
        }
    };

    const handleDebtCheck = (e) => {
        const checked = e.target.checked;
        setIsDebtChecked(checked);
        setIsCartChecked(false);
        if (checked && buyerInfo.currentBalance < 0) {
            setAmount(Math.abs(buyerInfo.currentBalance).toFixed(2));
        } else if (!checked) {
            setAmount('');
        }
    };

    const handlePayment = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch('/api/payment/tosla/init', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount, cardHolderName, cardNumber, expireMonth, expireYear, cvv })
            });
            const data = await res.json();
            
            if (res.ok && data.success) {
                setThreeDHtml(data.data);
            } else {
                alert('Ödeme başlatılamadı: ' + (data.error || 'Bilinmeyen hata'));
            }
        } catch (error) {
            console.error('Payment Error:', error);
            alert('Ödeme işlemi sırasında bir hata oluştu.');
        } finally {
            setLoading(false);
        }
    };

    if (threeDHtml) {
        return (
            <div className="page-wrapper">
                <div style={{ padding: 40, textAlign: 'center' }}>
                    <h2>Güvenli Ödeme Sayfasına Yönlendiriliyorsunuz...</h2>
                    <p>Lütfen bekleyin.</p>
                    <div dangerouslySetInnerHTML={{ __html: threeDHtml }} />
                </div>
            </div>
        );
    }

    const showCartBox = (buyerInfo.currentBalance === 0) || (buyerInfo.currentBalance < 0 && cartTotal && parseFloat(cartTotal) > 0);
    const showDebtBox = (buyerInfo.currentBalance < 0);

    return (
        <div className="page-wrapper">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Online Ödeme (Sanal POS)</h1>
                    <p className="page-subtitle">Kredi kartınızla anında bakiye yükleyin veya fatura ödeyin</p>
                </div>
            </div>

            <div style={{ display: 'flex', gap: 30, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '300px' }}>
                    <div className="card" style={{ padding: 30 }}>
                        <h2 style={{ marginBottom: 20, fontSize: 18, fontWeight: 700 }}>Ödeme Bilgileri</h2>
                        <form onSubmit={handlePayment}>
                            <div className="form-group" style={{ marginBottom: 20 }}>
                                <label className="form-label">Ödenecek Tutar (₺)</label>
                                <input type="number" step="0.01" className="form-input" style={{ fontSize: 24, padding: '12px 16px', fontWeight: 'bold', color: 'var(--primary)' }} value={amount} onChange={e => { setAmount(e.target.value); setIsCartChecked(false); setIsDebtChecked(false); }} placeholder="0.00" required />
                            </div>
                            
                            <div className="form-group" style={{ marginBottom: 15 }}>
                                <label className="form-label">Kart Üzerindeki İsim</label>
                                <input type="text" className="form-input" value={cardHolderName} onChange={e => setCardHolderName(e.target.value)} placeholder="AD SOYAD" required />
                            </div>

                            <div className="form-group" style={{ marginBottom: 15 }}>
                                <label className="form-label">Kredi Kartı Numarası</label>
                                <input type="text" className="form-input" value={cardNumber} onChange={e => setCardNumber(e.target.value)} placeholder="0000 0000 0000 0000" maxLength="19" required />
                            </div>

                            <div style={{ display: 'flex', gap: 15, marginBottom: 20 }}>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label className="form-label">Son Kullanma (Ay)</label>
                                    <input type="text" className="form-input" value={expireMonth} onChange={e => setExpireMonth(e.target.value)} placeholder="AA" maxLength="2" required />
                                </div>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label className="form-label">Son Kullanma (Yıl)</label>
                                    <input type="text" className="form-input" value={expireYear} onChange={e => setExpireYear(e.target.value)} placeholder="YY" maxLength="2" required />
                                </div>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label className="form-label">CVV</label>
                                    <input type="text" className="form-input" value={cvv} onChange={e => setCvv(e.target.value)} placeholder="123" maxLength="4" required />
                                </div>
                            </div>

                            <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 6 }} disabled={loading}>
                                {loading ? 'İşleniyor...' : <><CreditCardIcon style={{ width: 18, height: 18 }} /> Güvenli Ödeme Yap (Tosla)</>}
                            </button>
                        </form>

                        <div style={{ marginTop: 24, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
                            <p style={{ marginBottom: 16 }}>Ödemeleriniz <strong style={{ color: 'var(--text-primary)' }}>Tosla</strong> güvencesiyle 256-bit SSL ile şifrelenmektedir.</p>

                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '24px',
                                padding: '16px 24px',
                                background: 'rgba(255, 255, 255, 0.03)',
                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                borderRadius: '12px',
                                marginBottom: '20px'
                            }}>
                                <img src="/user_logo3.png" alt="Troy" style={{ height: 32, width: 'auto', objectFit: 'contain', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }} onError={(e) => { e.target.style.display = 'none'; e.target.insertAdjacentHTML('afterend', '<span style="color:#0ea5e9; font-weight:900; font-size:18px; font-style: italic;">troy</span>'); }} />
                                <img src="/user_logo2.png" alt="Visa" style={{ height: 24, width: 'auto', objectFit: 'contain', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }} onError={(e) => { e.target.style.display = 'none'; e.target.insertAdjacentHTML('afterend', '<span style="color:#1d4ed8; font-weight:900; font-size:22px; font-style: italic;">VISA</span>'); }} />
                                <img src="/user_logo1.png" alt="Mastercard" style={{ height: 32, width: 'auto', objectFit: 'contain', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }} onError={(e) => { e.target.style.display = 'none'; e.target.insertAdjacentHTML('afterend', '<span style="color:#dc2626; font-weight:bold; font-size:16px;">mastercard</span>'); }} />

                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    paddingLeft: '24px',
                                    borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
                                    height: '32px'
                                }}>
                                    <div style={{ width: 28, height: 28, background: '#10b981', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                                    </div>
                                    <div style={{ textAlign: 'left', lineHeight: '1.2' }}>
                                        <div style={{ fontSize: '10px', fontWeight: 700, color: '#10b981', letterSpacing: '0.5px' }}>256 BIT SSL</div>
                                        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)' }}>GÜVENLİ ÖDEME</div>
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
                                <Link href="/mesafeli-satis-sozlesmesi" target="_blank" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>Mesafeli Satış Sözleşmesi</Link>
                                <span style={{ color: 'var(--border)' }}>|</span>
                                <Link href="/iptal-ve-iade-kosullari" target="_blank" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>İptal ve İade Koşulları</Link>
                                <span style={{ color: 'var(--border)' }}>|</span>
                                <Link href="/gizlilik-ve-guvenlik" target="_blank" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>Gizlilik Politikası</Link>
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{ flex: '0 0 320px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {showCartBox && (
                        <div className="card" style={{ padding: 24, border: isCartChecked ? '2px solid var(--primary)' : '1px solid var(--border)', transition: 'all 0.2s' }}>
                            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: isCartChecked ? 'var(--primary)' : 'inherit' }}>Sepet Ödemesi</h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16 }}>Siparişinizi tamamlamak için mevcut sepet tutarı kadar bakiye yükleyerek devam edebilirsiniz.</p>
                            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16, marginBottom: 16 }}>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Ödenecek Tutar:</div>
                                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--primary)' }}>₺{parseFloat(cartTotal || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</div>
                            </div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 12px', background: isCartChecked ? 'rgba(var(--primary-rgb), 0.1)' : 'transparent', borderRadius: 8, transition: 'all 0.2s' }}>
                                <input
                                    type="checkbox"
                                    checked={isCartChecked}
                                    onChange={handleCartCheck}
                                    style={{ width: 20, height: 20, accentColor: 'var(--primary)', cursor: 'pointer' }}
                                />
                                <span style={{ fontWeight: 600, fontSize: 14, color: isCartChecked ? 'var(--primary)' : 'inherit' }}>Bu tutarı öde</span>
                            </label>
                        </div>
                    )}

                    {showDebtBox && (
                        <div className="card" style={{ padding: 24, border: isDebtChecked ? '2px solid var(--danger)' : '1px solid var(--border)', transition: 'all 0.2s' }}>
                            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: isDebtChecked ? 'var(--danger)' : 'inherit' }}>Cari Borç Ödemesi</h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16 }}>Cari hesabınızda bulunan güncel borç tutarınızı anında kolayca ödeyebilirsiniz.</p>
                            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16, marginBottom: 16 }}>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Güncel Cari Borcunuz:</div>
                                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--danger)' }}>₺{Math.abs(buyerInfo.currentBalance).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</div>
                            </div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 12px', background: isDebtChecked ? 'rgba(220, 38, 38, 0.1)' : 'transparent', borderRadius: 8, transition: 'all 0.2s' }}>
                                <input
                                    type="checkbox"
                                    checked={isDebtChecked}
                                    onChange={handleDebtCheck}
                                    style={{ width: 20, height: 20, accentColor: 'var(--danger)', cursor: 'pointer' }}
                                />
                                <span style={{ fontWeight: 600, fontSize: 14, color: isDebtChecked ? 'var(--danger)' : 'inherit' }}>Tüm borcumu öde</span>
                            </label>
                        </div>
                    )}

                    {/* Akbank Tosla Info Box */}
                    <div style={{
                        marginTop: 'auto',
                        padding: '16px',
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        color: 'var(--text-secondary)',
                        fontSize: '13px'
                    }}>
                        <span><strong>TOSLA,</strong> bir</span>
                        <img
                            src="https://upload.wikimedia.org/wikipedia/commons/8/87/Akbank_logo.svg"
                            alt="Akbank"
                            style={{ height: '14px', opacity: 0.9 }}
                            onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.insertAdjacentHTML('afterend', '<strong style="color:#e31837; font-style:italic; font-family:Arial, sans-serif; letter-spacing:-0.5px">AKBANK</strong>');
                            }}
                        />
                        <span>ödeme yöntemidir.</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
