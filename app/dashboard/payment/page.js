'use client';
import { useState, useEffect } from 'react';
import { CreditCardIcon, ArrowLeftIcon, ShoppingCartIcon, ChatBubbleLeftEllipsisIcon } from '@heroicons/react/24/outline';
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
    const [isInfoLoading, setIsInfoLoading] = useState(true);
    const [infoError, setInfoError] = useState(null);
    const [toslaData, setToslaData] = useState(null);
    const [buyerInfo, setBuyerInfo] = useState({ email: '', phone: '', companyId: '', companyName: '', currentBalance: 0 });
    const [context, setContext] = useState('');

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const amt = params.get('amount');
            const ctx = params.get('context');
            if (amt) setAmount(amt);
            if (ctx) setContext(ctx);

            const cTot = sessionStorage.getItem('pendingCartTotal');
            if (cTot) {
                setCartTotal(cTot);
                // Auto-select cart if it exists and no manual amount was provided in URL
                if (!amt) {
                    setIsCartChecked(true);
                    setAmount(parseFloat(cTot).toFixed(2));
                }
            }
        }

        const fetchUser = async () => {
            let backupName = '';
            if (typeof window !== 'undefined') {
                backupName = localStorage.getItem('storedCompanyName') || '';
                if (backupName) {
                    setBuyerInfo(prev => ({ ...prev, companyName: backupName }));
                }
            }

            setInfoError(null);
            try {
                const res = await fetch('/api/user/info', { cache: 'no-store' });
                if (res.ok) {
                    const data = await res.json();
                    setBuyerInfo({
                        email: data.email || '',
                        phone: data.phone || '',
                        companyId: data.companyId || '',
                        companyName: data.companyName || backupName || '',
                        currentBalance: Number(data.currentBalance) || 0
                    });
                    
                    if (data.companyName && typeof window !== 'undefined') {
                        localStorage.setItem('storedCompanyName', data.companyName);
                    }
                } else {
                    const errData = await res.json().catch(() => ({}));
                    if (!backupName) {
                        setInfoError(errData.error || 'Bilgiler alınamadı.');
                    }
                }
            } catch (err) {
                console.error('Error fetching user info:', err);
                if (!backupName) {
                    setInfoError('Bağlantı hatası.');
                }
            } finally {
                setIsInfoLoading(false);
            }
        };

        fetchUser();
    }, []);

    useEffect(() => {
        if (toslaData) {
            document.getElementById("tosla3dForm")?.submit();
        }
    }, [toslaData]);

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
                setToslaData(data.data);
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

    if (toslaData) {
        return (
            <div className="page-wrapper">
                <div style={{ padding: 40, textAlign: 'center' }}>
                    <h2>Güvenli Ödeme Sayfasına Yönlendiriliyorsunuz...</h2>
                    <p>Lütfen bekleyin.</p>
                    <div dangerouslySetInnerHTML={{ __html: toslaData }} />
                </div>
            </div>
        );
    }

    // New Visibility Logic
    const showCartBox = (buyerInfo.currentBalance === 0) || (buyerInfo.currentBalance < 0 && cartTotal && parseFloat(cartTotal) > 0);
    const showDebtBox = (buyerInfo.currentBalance < 0);

    return (
        <div className="page-wrapper">
            <div className="page-header">
                <Link href="/dashboard/cart" className="btn btn-ghost btn-sm" style={{ marginBottom: 10 }}>
                    <ArrowLeftIcon style={{ width: 14, height: 14, marginRight: 6 }} /> Sepete Dön
                </Link>
                <div>
                    <h1 className="page-title">Online Ödeme</h1>
                    <p className="page-subtitle">Kredi kartınızla anında ödeme yapın</p>
                </div>
            </div>

            <div style={{ display: 'flex', gap: 30, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div className="card" style={{ flex: '1', minWidth: '300px', padding: 30 }}>
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
                            <input type="text" className="form-input" value={cardNumber} onChange={e => {
                                let val = e.target.value.replace(/\D/g, '');
                                let matches = val.match(/\d{4,16}/g);
                                let match = matches && matches[0] || '';
                                let parts = [];
                                for (let i=0, len=match.length; i<len; i+=4) {
                                    parts.push(match.substring(i, i+4));
                                }
                                if (parts.length) setCardNumber(parts.join(' '));
                                else setCardNumber(val);
                            }} placeholder="0000 0000 0000 0000" maxLength="19" required />
                        </div>

                        <div style={{ display: 'flex', gap: 15, marginBottom: 20 }}>
                            <div className="form-group" style={{ flex: 1 }}>
                                <label className="form-label">Ay</label>
                                <input type="text" className="form-input" value={expireMonth} onChange={e => setExpireMonth(e.target.value.replace(/\D/g, ''))} placeholder="AA" maxLength="2" required />
                            </div>
                            <div className="form-group" style={{ flex: 1 }}>
                                <label className="form-label">Yıl</label>
                                <input type="text" className="form-input" value={expireYear} onChange={e => setExpireYear(e.target.value.replace(/\D/g, ''))} placeholder="YY" maxLength="2" required />
                            </div>
                            <div className="form-group" style={{ flex: 1 }}>
                                <label className="form-label">CVV</label>
                                <input type="password" className="form-input" value={cvv} onChange={e => setCvv(e.target.value.replace(/\D/g, ''))} placeholder="***" maxLength="4" required />
                            </div>
                        </div>

                        <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center' }} disabled={loading || !amount || parseFloat(amount) <= 0}>
                            {loading ? 'İşleniyor...' : <><CreditCardIcon style={{ width: 18, height: 18, marginRight: 8 }} /> Güvenli Ödeme Yap</>}
                        </button>
                    </form>

                    <div style={{ marginTop: 24, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '24px', padding: '16px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border)', borderRadius: '12px', marginBottom: '20px' }}>
                            <img src="/user_logo3.png" alt="Troy" style={{ height: 24 }} onError={e => e.target.style.display='none'} />
                            <img src="/user_logo2.png" alt="Visa" style={{ height: 18 }} onError={e => e.target.style.display='none'} />
                            <img src="/user_logo1.png" alt="Mastercard" style={{ height: 24 }} onError={e => e.target.style.display='none'} />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                            <Link href="/mesafeli-satis-sozlesmesi" target="_blank">Sözleşme</Link>
                            <Link href="/iptal-ve-iade-kosullari" target="_blank">İade Koşulları</Link>
                            <Link href="/gizlilik-ve-guvenlik" target="_blank">Gizlilik</Link>
                        </div>
                    </div>
                </div>

                <div style={{ flex: '0 0 320px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {showCartBox && (
                        <div className="card" style={{ padding: 24, border: isCartChecked ? '2px solid var(--primary)' : '1px solid var(--border)', transition: 'all 0.2s' }}>
                            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: isCartChecked ? 'var(--primary)' : 'inherit' }}>Sepet Ödemesi</h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>Siparişinizi tamamlamak için sepet tutarı kadar ödeme yapın.</p>
                            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 12, marginBottom: 16 }}>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Ödenecek Tutar:</div>
                                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--primary)' }}>₺{parseFloat(cartTotal || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</div>
                            </div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '8px 12px', background: isCartChecked ? 'rgba(var(--primary-rgb), 0.1)' : 'transparent', borderRadius: 8 }}>
                                <input type="checkbox" checked={isCartChecked} onChange={handleCartCheck} style={{ width: 18, height: 18, accentColor: 'var(--primary)' }} />
                                <span style={{ fontWeight: 600, fontSize: 14 }}>Bu tutarı öde</span>
                            </label>
                        </div>
                    )}

                    {showDebtBox && (
                        <div className="card" style={{ padding: 24, border: isDebtChecked ? '2px solid var(--danger)' : '1px solid var(--border)', transition: 'all 0.2s' }}>
                            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: isDebtChecked ? 'var(--danger)' : 'inherit' }}>Cari Borç Ödemesi</h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>Gecikmiş veya güncel cari borcunuzu kapatın.</p>
                            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 12, marginBottom: 16 }}>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Cari Borcunuz:</div>
                                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--danger)' }}>₺{Math.abs(buyerInfo.currentBalance).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</div>
                            </div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '8px 12px', background: isDebtChecked ? 'rgba(220, 38, 38, 0.1)' : 'transparent', borderRadius: 8 }}>
                                <input type="checkbox" checked={isDebtChecked} onChange={handleDebtCheck} style={{ width: 18, height: 18, accentColor: 'var(--danger)' }} />
                                <span style={{ fontWeight: 600, fontSize: 14 }}>Borcumu öde</span>
                            </label>
                        </div>
                    )}

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
