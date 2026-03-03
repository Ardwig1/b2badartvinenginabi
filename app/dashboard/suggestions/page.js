'use client';
import { PaperAirplaneIcon } from '@heroicons/react/24/outline';

export default function SuggestionsPage() {
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

                <form style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div className="form-group">
                        <label className="form-label">Konu Başlığı</label>
                        <input type="text" className="form-input" placeholder="Örn: Stok Hatası / Arama Problemi" required />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Detaylı Mesajınız</label>
                        <textarea className="form-input" rows="6" placeholder="Lütfen detayları yazınız..." required></textarea>
                    </div>

                    <button type="button" className="btn btn-primary btn-lg" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={() => alert('Mesajınız başarıyla iletilmiştir. Geliştirmeler için teşekkür ederiz!')}>
                        <PaperAirplaneIcon style={{ width: 16, height: 16 }} /> Gönder
                    </button>
                </form>
            </div>
        </div>
    );
}
