export default function GizlilikVeGuvenlik() {
    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px', lineHeight: '1.6', color: '#f0f0f0' }}>
            <h1 style={{ fontSize: '28px', marginBottom: '20px', borderBottom: '1px solid #333', paddingBottom: '10px' }}>
                Gizlilik ve Güvenlik Politikası
            </h1>

            <p>
                ARTPAR olarak, kullanıcılarımızın hizmetlerimizden güvenli ve eksiksiz şekilde faydalanmasını
                sağlamak amacıyla sitemizi kullanan bayi/üyelerimizin gizliliğini korumak için azami özen göstermekteyiz.
            </p>

            <h3 style={{ marginTop: '20px' }}>1. Kişisel Verilerin İşlenmesi ve KVKK İzni</h3>
            <p>
                Sistemimize kaydedilen isim, soyisim, telefon, adres ve ticari unvan gibi bilgiler, 6698 Sayılı Kişisel
                Verilerin Korunması Kanunu (KVKK) uyarınca ticari faaliyetlerin sürdürülebilmesi, fatura kesilebilmesi ve
                b2b altyapısının işletilebilmesi amacıyla saklanmaktadır. Verileriniz, yasal zorunluluklar haricinde hiçbir
                üçüncü şahıs veya kurumla paylaşılmaz.
            </p>

            <h3 style={{ marginTop: '20px' }}>2. Çerezler (Cookies)</h3>
            <p>
                B2B portalımız, size daha iyi ve kişiselleştirilmiş bir kullanıcı deneyimi sunabilmek için çerez (cookie)
                kullanmaktadır. Cihazınıza yerleştirilen çerezler, sepet bilgileri ve oturum açma durumu gibi temel verileri
                tutar. Tarayıcı ayarlarınızdan çerezleri engelleyebilirsiniz ancak kapalı b2b sistemi olduğundan uygulamanın
                çalışması aksayabilir.
            </p>

            <h3 style={{ marginTop: '20px' }}>3. Ödeme Güvenliği ve Kredi Kartı Bilgileri</h3>
            <p>
                Sitemiz üzerinden kredi kartı ile yapılan ödemelerde 256 bit SSL şifreleme teknolojisi kullanılmaktadır.
                Sanal POS ekranında girdiğiniz kredi kartı bilgileriniz doğrudan ilgili ödeme kuruluşuna (Tosla vb.)
                iletilir; kesinlikle sistemlerimizde, veritabanlarımızda saklanmaz veya kaydedilmez.
            </p>

            <h3 style={{ marginTop: '20px' }}>4. Güvenlik İhlallerine Karşı Koruma</h3>
            <p>
                Kullanıcı adı, bayi kodu ve şifre gibi bilgilerinizi güvende tutmak sizin sorumluluğunuzdadır. Şüpheli bir
                işlem hissettiğinizde lütfen derhal <strong>muratkaan@artpar.com</strong> üzerinden iletişime geçin.
            </p>

            <div style={{ marginTop: '40px', paddingTop: '20px', borderTop: '1px solid #333', fontSize: '14px', textAlign: 'center' }}>
                <a href="/login" style={{ color: '#4da6ff', textDecoration: 'none' }}>← Giriş Ekranına Dön</a>
            </div>
        </div>
    );
}
