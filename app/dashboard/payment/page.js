'use client';
import { useState } from 'react';
import { CreditCardIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';

export default function PaymentPage() {
    const [amount, setAmount] = useState('');
    const [loading, setLoading] = useState(false);

    const [token, setToken] = useState(null);

    const handlePayment = async (e) => {
        e.preventDefault();
        alert('Sanal POS entegrasyonu (PayTR) hazırlık aşamasındadır. Lütfen daha sonra tekrar deneyiniz.');
        return;
    };

    return (
        <div className="page-wrapper">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Online Ödeme (Sanal POS)</h1>
                    <p className="page-subtitle">Kredi kartınızla anında bakiye yükleyin veya fatura ödeyin</p>
                </div>
            </div>

            <div className="card" style={{ maxWidth: 600, margin: '0 auto', padding: 30 }}>
                {token ? (
                    <div style={{ width: '100%', height: 600 }}>
                        <iframe
                            src={`https://www.paytr.com/odeme/guvenli/${token}`}
                            id="paytriframe"
                            frameBorder="0"
                            scrolling="no"
                            style={{ width: '100%', height: '100%' }}
                        />
                        <button className="btn btn-secondary" style={{ width: '100%', marginTop: 20, justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => setToken(null)}>
                            <ArrowLeftIcon style={{ width: 14, height: 14 }} /> İptal Et ve Geri Dön
                        </button>
                    </div>
                ) : (
                    <>
                        <h2 style={{ marginBottom: 20, fontSize: 18, fontWeight: 700 }}>Ödeme Bilgileri</h2>
                        <form onSubmit={handlePayment}>
                            <div className="form-group" style={{ marginBottom: 20 }}>
                                <label className="form-label">Ödenecek Tutar (₺)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="form-input"
                                    style={{ fontSize: 24, padding: '12px 16px', fontWeight: 'bold', color: 'var(--primary)' }}
                                    value={amount}
                                    onChange={e => setAmount(e.target.value)}
                                    placeholder="0.00"
                                    required
                                />
                            </div>
                            <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 6 }} disabled={loading}>
                                {loading ? 'İşleminiz Hazırlanıyor...' : <><CreditCardIcon style={{ width: 18, height: 18 }} /> Güvenli Ödeme Yap (PayTR)</>}
                            </button>
                        </form>

                        <div style={{ marginTop: 24, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
                            <p style={{ marginBottom: 16 }}>Ödemeleriniz <strong style={{ color: 'var(--text-primary)' }}>PayTR</strong> güvencesiyle 256-bit SSL ile şifrelenmektedir.</p>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
                                <a href="/mesafeli-satis-sozlesmesi" target="_blank" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>Mesafeli Satış Sözleşmesi</a>
                                <span style={{ color: 'var(--border)' }}>|</span>
                                <a href="/iptal-ve-iade-kosullari" target="_blank" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>İptal ve İade Koşulları</a>
                                <span style={{ color: 'var(--border)' }}>|</span>
                                <a href="/gizlilik-ve-guvenlik" target="_blank" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>Gizlilik Politikası</a>
                            </div>
                            <p style={{ marginTop: 16, fontSize: 12 }}>Ödeme yaparak yukarıdaki sözleşme ve koşulları kabul etmiş sayılırsınız.</p>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
