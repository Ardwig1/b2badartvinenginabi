'use client';
import { useState } from 'react';
import { CreditCardIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';

export default function PaymentPage() {
    const [amount, setAmount] = useState('');
    const [cardHolderName, setCardHolderName] = useState('');
    const [cardNumber, setCardNumber] = useState('');
    const [expireMonth, setExpireMonth] = useState('');
    const [expireYear, setExpireYear] = useState('');
    const [cvv, setCvv] = useState('');
    
    const [loading, setLoading] = useState(false);
    const [threeDHtml, setThreeDHtml] = useState(null);

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
                // Render the 3D secure HTML form
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
        // 3D formunu ekrana render etmek için div. 
        // Genelde bankalar <form>...</form> render edip otomatik submit eden bir JS döner.
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

    return (
        <div className="page-wrapper">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Online Ödeme (Sanal POS)</h1>
                    <p className="page-subtitle">Kredi kartınızla anında bakiye yükleyin veya fatura ödeyin</p>
                </div>
            </div>

            <div className="card" style={{ maxWidth: 600, margin: '0 auto', padding: 30 }}>
                <h2 style={{ marginBottom: 20, fontSize: 18, fontWeight: 700 }}>Ödeme Bilgileri</h2>
                <form onSubmit={handlePayment}>
                    <div className="form-group" style={{ marginBottom: 20 }}>
                        <label className="form-label">Ödenecek Tutar (₺)</label>
                        <input type="number" step="0.01" className="form-input" style={{ fontSize: 24, padding: '12px 16px', fontWeight: 'bold', color: 'var(--primary)' }} value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" required />
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

                    {/* Payment Logos Block - Styled like the reference image */}
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
                    <p style={{ marginTop: 16, fontSize: 12 }}>Ödeme yaparak yukarıdaki sözleşme ve koşulları kabul etmiş sayılırsınız.</p>
                </div>
            </div>
        </div>
    );
}
