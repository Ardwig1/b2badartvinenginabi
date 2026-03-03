'use client';
import { PaperAirplaneIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';

export default function SuggestionsPage() {
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState({ type: '', text: '' });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setStatus({ type: '', text: '' });

        try {
            const res = await fetch('/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subject, message }),
            });
            const data = await res.json();

            if (res.ok) {
                setStatus({ type: 'success', text: 'Mesajınız başarıyla iletilmiştir. Geliştirmeler için teşekkür ederiz!' });
                setSubject('');
                setMessage('');
            } else {
                setStatus({ type: 'error', text: data.error || 'Gönderim sırasında bir hata oluştu.' });
            }
        } catch (error) {
            setStatus({ type: 'error', text: 'Bağlantı hatası: Mesaj gönderilemedi.' });
        }
        setLoading(false);
    };
    return (
        <div className="page-wrapper">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Öneri ve Şikayet Formu</h1>
                    <p className="page-subtitle">Görüşleriniz bizim için değerlidir</p>
                </div>
            </div>

            <div className="card" style={{ maxWidth: 600, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    B2B platformumuzla ilgili karşılaştığınız sorunları, iyileştirme önerilerinizi veya şikayetlerinizi bu form aracılığıyla doğrudan yönetime iletebilirsiniz.
                </p>

                {status.text && (
                    <div style={{
                        marginBottom: 16, padding: '12px 16px', borderRadius: 8, fontSize: 14,
                        backgroundColor: status.type === 'success' ? '#dcfce7' : '#fee2e2',
                        color: status.type === 'success' ? '#16a34a' : '#dc2626'
                    }}>
                        {status.text}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div className="form-group">
                        <label className="form-label">Konu Başlığı</label>
                        <input type="text" className="form-input" placeholder="Örn: Stok Hatası / Arama Problemi" value={subject} onChange={e => setSubject(e.target.value)} required id="suggestion-subject" />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Detaylı Mesajınız</label>
                        <textarea className="form-input" rows="6" placeholder="Lütfen detayları yazınız..." value={message} onChange={e => setMessage(e.target.value)} required id="suggestion-message"></textarea>
                    </div>

                    <button type="submit" className="btn btn-primary btn-lg" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} disabled={loading} id="suggestion-submit">
                        {loading ? 'Gönderiliyor...' : <><PaperAirplaneIcon style={{ width: 16, height: 16 }} /> Gönder</>}
                    </button>
                </form>
            </div>
        </div>
    );
}
