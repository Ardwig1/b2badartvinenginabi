export default function FilesPage() {
    return (
        <div className="page-wrapper">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Dosyalar</h1>
                    <p className="page-subtitle">Şirketimize ait katalog ve sunum dosyaları</p>
                </div>
            </div>

            <div className="card">
                <div className="empty-state" style={{ padding: '60px 0' }}>
                    <div className="empty-state-icon" style={{ fontSize: 60, marginBottom: 16 }}>📁</div>
                    <div className="empty-state-title" style={{ fontSize: 18, fontWeight: 600 }}>Henüz dosya yüklenmedi</div>
                    <div className="empty-state-text" style={{ color: 'var(--text-secondary)' }}>Katalog ve ürün broşürleri buraya eklenecektir.</div>
                </div>
            </div>
        </div>
    );
}
