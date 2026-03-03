'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import styles from './auth.module.css';

export default function LoginPage() {
    const router = useRouter();
    const [dealerCode, setDealerCode] = useState('');
    const [userCode, setUserCode] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // 1. Fetch real email via lookup API
            const lookupRes = await fetch('/api/auth/lookup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dealerCode, userCode })
            });
            const lookupData = await lookupRes.json();

            if (!lookupRes.ok) {
                setError(lookupData.error || 'Giriş bilgileri doğrulanamadı.');
                setLoading(false);
                return;
            }

            const email = lookupData.email;

            // 2. Sign in with the retrieved email
            const supabase = createClient();
            const { error: err } = await supabase.auth.signInWithPassword({ email, password });

            if (err) {
                setError(err.message === 'Invalid login credentials'
                    ? 'Kullanıcı bilgileri veya şifre hatalı.'
                    : err.message);
                setLoading(false);
                return;
            }

            // Check if admin
            const { data: { user } } = await supabase.auth.getUser();
            const { data: profile } = await supabase
                .from('profiles')
                .select('is_admin')
                .eq('id', user.id)
                .single();

            router.push(profile?.is_admin ? '/admin' : '/dashboard');
            router.refresh();
        } catch (err) {
            setError('Giriş yapılırken bir hata oluştu: ' + err.message);
            setLoading(false);
        }
    };

    return (
        <div className={styles.authBg}>
            <div className={styles.authCard}>
                <div className={styles.authLogo}>
                    <span className={styles.logoIcon}>⚙️</span>
                    <h1 className={styles.logoText}>B2B Parça</h1>
                </div>
                <h2 className={styles.authTitle}>Hoş Geldiniz</h2>
                <p className={styles.authDesc}>Bayi panelinize erişmek için giriş yapın</p>

                <form onSubmit={handleLogin} className={styles.authForm}>
                    {error && <div className={styles.errorBox}>{error}</div>}

                    <div className="form-group">
                        <label className="form-label">Bayi Kodu</label>
                        <input
                            className="form-input"
                            type="text"
                            placeholder="Örn: B-1001"
                            value={dealerCode}
                            onChange={e => setDealerCode(e.target.value.toUpperCase())}
                            required
                            id="login-dealer-code"
                            autoComplete="off"
                            style={{ textTransform: 'uppercase' }}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Kullanıcı Kodu</label>
                        <input
                            className="form-input"
                            type="text"
                            placeholder="Örn: ADMIN"
                            value={userCode}
                            onChange={e => setUserCode(e.target.value.toUpperCase())}
                            required
                            id="login-user-code"
                            autoComplete="off"
                            style={{ textTransform: 'uppercase' }}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Şifre</label>
                        <input
                            className="form-input"
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                            id="login-password"
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary btn-lg"
                        disabled={loading}
                        id="login-submit"
                        style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }}
                    >
                        {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
                    </button>
                </form>


            </div>

            {/* PayTR Required Footer */}
            <div style={{
                position: 'absolute',
                bottom: 0,
                width: '100%',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '10px',
                fontSize: '12px',
                color: '#888',
                backgroundColor: 'rgba(0, 0, 0, 0.4)',
                borderTop: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <a href="/mesafeli-satis-sozlesmesi" target="_blank" style={{ color: '#aaa', textDecoration: 'underline' }}>Mesafeli Satış Sözleşmesi</a>
                    <a href="/iptal-ve-iade-kosullari" target="_blank" style={{ color: '#aaa', textDecoration: 'underline' }}>İptal ve İade Koşulları</a>
                    <a href="/gizlilik-ve-guvenlik" target="_blank" style={{ color: '#aaa', textDecoration: 'underline' }}>Gizlilik ve Güvenlik Politikası</a>
                </div>
                <div style={{ textAlign: 'center', lineHeight: '1.4' }}>
                    <strong>OMİ GROUP'S</strong><br />
                    B2B Yedek Parça Satış Portalı<br />
                    Ofis: SOĞUKPINAR MAH. IHLAMUR CAD. NO:37 ÇEKMEKÖY / İSTANBUL<br />
                    Depo: MİMAR SİNAN MAH YEDPA TİCARET MERKEZİ İÇİ ATAŞEHİR / İSTANBUL<br />
                    Tel: 0532 597 0664 | E-posta: muratkaan@omigroups.com<br />
                    Vergi Dairesi: Sarıgazi VD. / 800081338
                </div>
            </div>
        </div>
    );
}
