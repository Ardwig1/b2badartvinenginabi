export default function IptalIadeKosullari() {
    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px', lineHeight: '1.6', color: '#f0f0f0' }}>
            <h1 style={{ fontSize: '28px', marginBottom: '20px', borderBottom: '1px solid #333', paddingBottom: '10px' }}>
                İptal ve İade Koşulları
            </h1>

            <p>OMIGROUPS B2B yedek parça satış platformu üzerinden verilen siparişlerde kurumsal iade ve iptal şartları geçerlidir.</p>

            <h3 style={{ marginTop: '20px' }}>1. Sipariş İptali</h3>
            <p>
                Verilen siparişler, ürün kargoya teslim edilmeden önce firmamız destek hatları (muratkaan@omigroups.com) üzerinden
                iptal edilebilir. Kargoya verilmiş olan siparişlerin iptali mümkün olmayıp, ancak teslim alındıktan sonra iade
                sürecine tabi tutulabilir.
            </p>

            <h3 style={{ marginTop: '20px' }}>2. İade Şartları</h3>
            <ul>
                <li style={{ marginBottom: '10px' }}>İade edilecek ürünlerin orijinal ambalajı bozulmamış, kullanılmamış ve yeniden satılabilir durumda olması şarttır.</li>
                <li style={{ marginBottom: '10px' }}>B2B (kurumsal) işlemler kapsamında ürün iadeleri, mutabakat sağlanarak ve iade faturası kesilerek işleme alınır. İade faturası kesilmeyen durumlar işleme alınmayacaktır.</li>
                <li style={{ marginBottom: '10px' }}>Elektronik parçalar ve özel sipariş üzerine getirilen yurtdışı menşeili yedek parçaların iadesi ancak ürünün kusurlu çıkması durumunda kabul edilir.</li>
                <li style={{ marginBottom: '10px' }}>İade süresi, teslim tarihinden itibaren aksi yönde bir sözleşme yapılmadıkça 14 (on dört) gündür.</li>
            </ul>

            <h3 style={{ marginTop: '20px' }}>3. Ayıplı / Kusurlu Ürün İadesi</h3>
            <p>
                Tarafımızdan gönderilen ürünlerde fabrika çıkışlı bir üretim hatası tespit edilmesi durumunda, ürün incelenmek
                üzere tarafımıza gönderilir. İnceleme sonucunda ürünün kusurlu olduğu onaylanırsa ürün yenisi ile değiştirilir
                veya bakiye iadesi yapılır.
            </p>

            <h3 style={{ marginTop: '20px' }}>4. Geri Ödemeler</h3>
            <p>
                İade edilen ürünler tarafımıza ulaşıp onaylandıktan sonra, ödeme yönteminize bağlı olarak 7 (yedi) iş günü
                içerisinde tanımlı banka hesabınıza veya kredi kartınıza iade edilir.
            </p>

            <div style={{ marginTop: '40px', paddingTop: '20px', borderTop: '1px solid #333', fontSize: '14px', textAlign: 'center' }}>
                <a href="/login" style={{ color: '#4da6ff', textDecoration: 'none' }}>← Giriş Ekranına Dön</a>
            </div>
        </div>
    );
}
