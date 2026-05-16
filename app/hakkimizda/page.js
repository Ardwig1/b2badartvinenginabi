import styles from '../login/auth.module.css';

export default function Hakkimizda() {
    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-default)', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ maxWidth: 800, margin: '0 auto', padding: '60px 20px', flex: 1 }}>

                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 40, borderBottom: '1px solid var(--border-light)', paddingBottom: 20 }}>
                    <a href="/login" style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                        <span style={{ fontSize: 20 }}>←</span> Geri Dön
                    </a>
                </div>

                <div style={{ textAlign: 'center', marginBottom: 40 }}>
                    <img src="/artpar-logo.png" alt="ARTPAR Logo" style={{ width: 180, height: 'auto', marginBottom: 20 }} />
                    <h1 style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif' }}>Hakkımızda</h1>
                </div>

                <div className="card" style={{ padding: 40, lineHeight: 1.8, fontSize: 15, color: 'var(--text-secondary)' }}>
                    <p style={{ marginBottom: 20 }}>
                        Firmamız, 19 Temmuz 2023 tarihinde otomotiv yedek parça ve kesici takımlar sektöründe faaliyet göstermek amacıyla ARTPAR adı altında kurulmuştur. Kuruluşumuzdan itibaren sektörde edindiğimiz bilgi birikimi, deneyim ve tecrübelerimizi güçlü bir ticari anlayış ile birleştirerek müşterilerimize kaliteli, güvenilir ve sürdürülebilir hizmet sunmayı hedeflemekteyiz.
                    </p>

                    <p style={{ marginBottom: 20 }}>
                        Faaliyet gösterdiğimiz alanlarda kalite, güven ve müşteri memnuniyetini temel prensip olarak benimseyen firmamız; sektördeki gelişmeleri yakından takip ederek ürün ve hizmet ağını sürekli geliştirmeyi amaçlamaktadır. Otomotiv yedek parça ve kesici takımlar alanında, geniş ürün yelpazesi ve çözüm odaklı yaklaşımımız ile iş ortaklarımızın ihtiyaçlarına en doğru ve hızlı şekilde cevap vermeyi hedefliyoruz.
                    </p>

                    <p style={{ marginBottom: 20 }}>
                        Sektörde uzun yıllara dayanan tecrübelerimiz doğrultusunda, bu mesleğe gönül vermiş tüm esnaf ve iş ortaklarımızın yanında olmayı bir sorumluluk olarak görmekteyiz. Karşılıklı güvene dayalı ticaret anlayışımız, uygun ve sürdürülebilir çalışma şartlarımız ile hem iş ortaklarımız hem de müşterilerimiz için güçlü ve uzun vadeli iş birlikleri oluşturmayı amaçlamaktayız.
                    </p>

                    <p style={{ marginBottom: 20 }}>
                        Firmamız aynı zamanda ithalat ve ihracat alanındaki bilgi ve tecrübesi sayesinde ulusal ve uluslararası ticarette aktif rol almakta, global pazardaki gelişmeleri yakından takip ederek sektöre değer katmayı hedeflemektedir. Tedarik zincirini güçlü tutarak kaliteli ürünleri en doğru şartlarda müşterilerimize ulaştırmak, temel çalışma prensiplerimiz arasında yer almaktadır.
                    </p>

                    <p style={{ marginBottom: 0, fontWeight: 600, color: 'var(--text-primary)' }}>
                        Güvenilir ticaret anlayışı, dürüstlük ilkesi ve sürdürülebilir büyüme hedefi ile firmamız; sektöründe saygın, güçlü ve tercih edilen bir marka olma yolunda kararlı adımlarla ilerlemeye devam etmektedir.
                    </p>
                </div>
            </div>

            <footer style={{ background: '#0f172a', padding: '30px 20px', color: '#94a3b8', fontSize: 13, textAlign: 'center' }}>
                <p>© {new Date().getFullYear()} OPY Bilişim Yazılım İnternet ve Güvenlik Sistemleri Tic. Ltd. Şti. Tüm Hakları Saklıdır.</p>
            </footer>
        </div>
    );
}
