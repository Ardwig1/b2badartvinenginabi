export default function BankAccountsPage() {
    const accounts = [
        { bank: 'Yapı Kredi', name: 'Murat Kaan Şaşmaz', iban: 'TR91 0006 0701 0000 0000 1003 9880 0', branch: 'Merkez Şube' },
        { bank: 'İş Bankası', name: 'Murat Kaan Şaşmaz', iban: 'TR96 0006 4000 0011 2220 2017 93', branch: 'YEDPA Şube' },
    ];

    return (
        <div className="page-wrapper">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Banka Hesap Bilgilerimiz</h1>
                    <p className="page-subtitle">EFT / Havale işlemleriniz için hesap numaralarımız</p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>
                {accounts.map((acc, i) => (
                    <div key={i} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: 12 }}>
                            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--primary)' }}>{acc.bank}</div>
                            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{acc.branch}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Alıcı Adı</div>
                            <div style={{ fontWeight: 600 }}>{acc.name}</div>
                        </div>
                        <div style={{ background: 'var(--bg-surface)', padding: '12px', borderRadius: 'var(--radius)', marginTop: 8 }}>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>IBAN Numarası</div>
                            <div style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 14, color: 'var(--primary)', letterSpacing: 1 }}>{acc.iban}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
