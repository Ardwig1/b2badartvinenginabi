export default function ContactPage() {
    return (
        <div className="page-wrapper">
            <div className="page-header">
                <div>
                    <h1 className="page-title">İletişim Bilgilerimiz</h1>
                    <p className="page-subtitle">Bize ulaşabileceğiniz tüm kanallar</p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                        <div style={{ fontSize: 24, background: 'var(--bg-surface)', width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>📍</div>
                        <div>
                            <div style={{ fontWeight: 700, marginBottom: 4 }}>Genel Merkez & Depo</div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.5 }}>
                                Yedek Parça Organize Sanayi Bölgesi<br />
                                1. Cadde, No: 15<br />
                                Başakşehir / İstanbul
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                        <div style={{ fontSize: 24, background: 'var(--bg-surface)', width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>📞</div>
                        <div>
                            <div style={{ fontWeight: 700, marginBottom: 4 }}>Telefon Numaralarımız</div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.5 }}>
                                Müşteri Hizmetleri: 0850 000 00 00<br />
                                Satış Destek: 0212 000 00 01
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                        <div style={{ fontSize: 24, background: 'var(--bg-surface)', width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>✉️</div>
                        <div>
                            <div style={{ fontWeight: 700, marginBottom: 4 }}>E-Posta Adreslerimiz</div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.5 }}>
                                b2b@b2byedekparca.com<br />
                                destek@b2byedekparca.com
                            </div>
                        </div>
                    </div>
                </div>

                <div className="card" style={{ padding: 0, overflow: 'hidden', minHeight: 300, background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                        <div style={{ fontSize: 40, marginBottom: 8 }}>🗺️</div>
                        <div>Harita Görünümü</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
