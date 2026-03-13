'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import styles from './auth.module.css';

export default function LoginPage() {
    const router = useRouter();
    const [dealerCode, setDealerCode] = useState('');
    const [userCode, setUserCode] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const savedDealer = localStorage.getItem('b2b_dealer_code');
        const savedUser = localStorage.getItem('b2b_user_code');
        if (savedDealer && savedUser) {
            setDealerCode(savedDealer);
            setUserCode(savedUser);
            setRememberMe(true);
        }
    }, []);

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

            if (rememberMe) {
                localStorage.setItem('b2b_dealer_code', dealerCode);
                localStorage.setItem('b2b_user_code', userCode);
            } else {
                localStorage.removeItem('b2b_dealer_code');
                localStorage.removeItem('b2b_user_code');
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
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'radial-gradient(ellipse at top left, #1e3a5f 0%, #0f172a 50%, #0a1628 100%)' }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
                <div className={styles.authCard}>
                    <div className={styles.authLogo} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <img src="/omi-logo.png" alt="OMI GROUP'S Logo" style={{ width: '180px', height: 'auto', objectFit: 'contain' }} />
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

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.5rem', fontSize: '14px', color: 'var(--text-secondary)' }}>
                            <input
                                type="checkbox"
                                id="remember-me"
                                checked={rememberMe}
                                onChange={(e) => setRememberMe(e.target.checked)}
                                style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                            />
                            <label htmlFor="remember-me" style={{ cursor: 'pointer', userSelect: 'none' }}>Beni Hatırla</label>
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

                    {/* Tosla Test Hesabı */}
                    <div style={{
                        marginTop: '1.2rem',
                        padding: '14px 16px',
                        background: 'rgba(37, 99, 235, 0.08)',
                        border: '1px solid rgba(37, 99, 235, 0.2)',
                        borderRadius: '10px',
                        fontSize: '13px',
                        color: 'var(--text-secondary)',
                        lineHeight: '1.6'
                    }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6, fontSize: 13 }}>🔑 Tosla Entegrasyon Test Hesabı</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 12px', fontFamily: 'monospace', fontSize: 13 }}>
                            <span style={{ color: 'var(--text-muted)' }}>Bayi Kodu:</span><span style={{ fontWeight: 600 }}>TOSLA</span>
                            <span style={{ color: 'var(--text-muted)' }}>Kullanıcı Kodu:</span><span style={{ fontWeight: 600 }}>TOSLA</span>
                            <span style={{ color: 'var(--text-muted)' }}>Şifre:</span><span style={{ fontWeight: 600 }}>tosla1234</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Clean Footer for Requirements */}
            <div style={{
                position: 'relative',
                width: '100%',
                padding: '2rem 1rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(10px)',
                zIndex: 10
            }}>
                <div style={{ maxWidth: 1000, width: '100%', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '2rem' }}>

                    {/* Legal Links */}
                    <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                        <h4 style={{ color: '#fff', marginBottom: '8px', fontWeight: 600 }}>Kurumsal</h4>
                        <a href="/hakkimizda" target="_blank" style={{ color: '#bae6fd', fontWeight: 500, textDecoration: 'underline', transition: 'color 0.2s' }}>Hakkımızda</a>
                        <a href="/mesafeli-satis-sozlesmesi" target="_blank" style={{ color: '#bae6fd', fontWeight: 500, textDecoration: 'underline', transition: 'color 0.2s' }}>Mesafeli Satış Sözleşmesi</a>
                        <a href="/iptal-ve-iade-kosullari" target="_blank" style={{ color: '#bae6fd', fontWeight: 500, textDecoration: 'underline', transition: 'color 0.2s' }}>İptal ve İade Koşulları</a>
                        <a href="/gizlilik-ve-guvenlik" target="_blank" style={{ color: '#bae6fd', fontWeight: 500, textDecoration: 'underline', transition: 'color 0.2s' }}>Gizlilik ve Güvenlik</a>
                    </div>

                    {/* Contact details */}
                    <div style={{ flex: '1 1 300px', fontSize: '12px', color: '#cbd5e1', lineHeight: '1.6' }}>
                        <h4 style={{ color: '#fff', marginBottom: '8px', fontWeight: 600, fontSize: '13px' }}>İletişim</h4>
                        <p style={{ margin: 0 }}><strong>Murat Kaan Şaşmaz - OMİ GROUP'S</strong></p>
                        <p style={{ margin: 0 }}>Ofis: Soğukpınar Mah. Ihlamur Cad. No:37 Çekmeköy/İSTANBUL</p>
                        <p style={{ margin: 0 }}>Depo: Mimar Sinan Mah Yedpa Tic. Mrk. İçi Ataşehir/İSTANBUL</p>
                        <p style={{ margin: 0, marginTop: '4px' }}>Tel: 0532 597 0664 | E-posta: muratkaan@omigroups.com</p>
                        <p style={{ margin: 0 }}>Vergi Dairesi: Sarıgazi VD. / 800081338</p>
                    </div>

                    {/* Secure payment logos removed from here as per request */}

                </div>
            </div>
        </div>
    );
}
