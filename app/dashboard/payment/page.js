'use client';
import { useState } from 'react';
import { CreditCardIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';

export default function PaymentPage() {
    const [amount, setAmount] = useState('');
    const [loading, setLoading] = useState(false);

    const [token, setToken] = useState(null);

    const handlePayment = async (e) => {
        e.preventDefault();
        alert('Sanal POS entegrasyonu (Tosla) hazırlık aşamasındadır. Lütfen daha sonra tekrar deneyiniz.');
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
                        {loading ? 'İşleminiz Hazırlanıyor...' : <><CreditCardIcon style={{ width: 18, height: 18 }} /> Güvenli Ödeme Yap (Tosla)</>}
                    </button>
                </form>

                <div style={{ marginTop: 24, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
                    <p style={{ marginBottom: 16 }}>Ödemeleriniz <strong style={{ color: 'var(--text-primary)' }}>Tosla</strong> güvencesiyle 256-bit SSL ile şifrelenmektedir.</p>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
                        <a href="/mesafeli-satis-sozlesmesi" target="_blank" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>Mesafeli Satış Sözleşmesi</a>
                        <span style={{ color: 'var(--border)' }}>|</span>
                        <a href="/iptal-ve-iade-kosullari" target="_blank" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>İptal ve İade Koşulları</a>
                        <span style={{ color: 'var(--border)' }}>|</span>
                        <a href="/gizlilik-ve-guvenlik" target="_blank" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>Gizlilik Politikası</a>
                    </div>
                    <p style={{ marginTop: 16, fontSize: 12 }}>Ödeme yaparak yukarıdaki sözleşme ve koşulları kabul etmiş sayılırsınız.</p>
                </div>
            </div>
        </div>
    );
}
