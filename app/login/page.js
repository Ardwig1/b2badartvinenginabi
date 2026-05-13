'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { EyeIcon, EyeSlashIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import styles from './auth.module.css';
import Logo from '@/components/Logo';

function LoginContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const isMaintenance = searchParams.get('maintenance') === 'true';
    const [dealerCode, setDealerCode] = useState('');
    const [userCode, setUserCode] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isCapsLockOn, setIsCapsLockOn] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const checkCapsLock = (e) => {
            if (e.getModifierState && e.getModifierState('CapsLock')) {
                setIsCapsLockOn(true);
            } else {
                setIsCapsLockOn(false);
            }
        };

        window.addEventListener('keydown', checkCapsLock);
        window.addEventListener('keyup', checkCapsLock);
        return () => {
            window.removeEventListener('keydown', checkCapsLock);
            window.removeEventListener('keyup', checkCapsLock);
        };
    }, []);

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
            const userType = lookupData.type; // 'dealer' or 'representative'
            
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

            // Activity log for Login
            try {
                await fetch('/api/log-activity', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action_type: 'login' })
                });
            } catch (logErr) {
                console.error('Failed to log login activity:', logErr);
            }

            // Redirection logic
            if (userType === 'representative') {
                router.push('/rep');
            } else {
                const { data: { user } } = await supabase.auth.getUser();
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('is_admin')
                    .eq('id', user.id)
                    .single();

                router.push(profile?.is_admin ? '/admin' : '/dashboard');
            }
            router.refresh();
        } catch (err) {
            setError('Giriş yapılırken bir hata oluşti: ' + err.message);
            setLoading(false);
        }
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'radial-gradient(ellipse at top left, #1e3a5f 0%, #0f172a 50%, #0a1628 100%)' }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
                <div className={styles.authCard}>
                    <div className={styles.authLogo} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <img 
                            src="/logo.png" 
                            alt="Logo" 
                            style={{ width: '160px', height: 'auto', objectFit: 'contain' }} 
                            onError={(e) => {
                                if (!e.target.src.includes('omi-logo_2.png')) {
                                    e.target.src = '/omi-logo_2.png';
                                }
                            }}
                        />
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
                                placeholder="Bayi Kodunuz"
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
                                placeholder="Kullanıcı Kodunuz"
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
                            <div style={{ position: 'relative' }}>
                                <input
                                    className="form-input"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    required
                                    id="login-password"
                                    style={{ paddingRight: '45px' }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    style={{
                                        position: 'absolute',
                                        right: '12px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        background: 'none',
                                        border: 'none',
                                        padding: '4px',
                                        cursor: 'pointer',
                                        color: 'var(--text-muted)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        zIndex: 10
                                    }}
                                >
                                    {showPassword ? <EyeSlashIcon style={{ width: 20 }} /> : <EyeIcon style={{ width: 20 }} />}
                                </button>
                            </div>
                            {isCapsLockOn && (
                                <div style={{ 
                                    marginTop: '8px', 
                                    color: '#fbbf24', 
                                    fontSize: '12px', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '4px',
                                    fontWeight: 600 
                                }}>
                                    <ExclamationTriangleIcon style={{ width: 14 }} />
                                    <span>Dikkat: Caps Lock Açık!</span>
                                </div>
                            )}
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
                </div>
            </div>

            {/* Redesigned Footer Section */}
            <div style={{
                width: '100%',
                padding: '3rem 1.5rem 1.5rem',
                backgroundColor: 'rgba(15, 23, 42, 0.98)',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                backdropFilter: 'blur(15px)',
                zIndex: 10
            }}>
                <div style={{ maxWidth: 1200, margin: '0 auto' }}>
                    
                    {/* Logos Row */}
                    <div style={{ 
                        display: 'flex', 
                        flexWrap: 'wrap', 
                        justifyContent: 'center', 
                        alignItems: 'center', 
                        gap: '60px', 
                        marginBottom: '2.5rem' 
                    }}>
                        <Logo type="auto" color="#fff" />
                        <Logo type="tech" color="#3b82f6" />
                    </div>

                    {/* Contact Info Row */}
                    <div style={{ 
                        textAlign: 'center', 
                        fontSize: '13px', 
                        color: '#94a3b8', 
                        lineHeight: '1.8',
                        marginBottom: '2.5rem',
                        padding: '0 20px'
                    }}>
                        <p style={{ margin: 0, fontWeight: 700, color: '#f8fafc', fontSize: '14px' }}>ARTPAR OTOMOTİV</p>
                        <p style={{ margin: '4px 0' }}>Soğukpınar Mah. Ihlamur Cad. No:37 Çekmeköy/İSTANBUL | Mimar Sinan Mah Yedpa Tic. Mrk. Ataşehir/İSTANBUL</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '15px', marginTop: '4px' }}>
                            <span>📞 0532 597 0664</span>
                            <span>✉️ destek@artpar.com</span>
                            <span>🏢 Sarıgazi VD. / 800081338</span>
                        </div>
                    </div>

                    {/* Legal Links - Single Line */}
                    <div style={{ 
                        borderTop: '1px solid rgba(255,255,255,0.05)', 
                        paddingTop: '1.5rem',
                        display: 'flex', 
                        flexWrap: 'wrap', 
                        justifyContent: 'center', 
                        gap: '24px', 
                        fontSize: '12px' 
                    }}>
                        <a href="/hakkimizda" target="_blank" style={{ color: '#60a5fa', textDecoration: 'none', fontWeight: 500 }}>Hakkımızda</a>
                        <a href="/mesafeli-satis-sozlesmesi" target="_blank" style={{ color: '#60a5fa', textDecoration: 'none', fontWeight: 500 }}>Mesafeli Satış Sözleşmesi</a>
                        <a href="/iptal-ve-iade-kosullari" target="_blank" style={{ color: '#60a5fa', textDecoration: 'none', fontWeight: 500 }}>İptal ve İade Koşulları</a>
                        <a href="/gizlilik-ve-guvenlik" target="_blank" style={{ color: '#60a5fa', textDecoration: 'none', fontWeight: 500 }}>Gizlilik ve Güvenlik</a>
                        <span style={{ color: '#475569', marginLeft: 'auto' }}>© 2026 ARTPAR</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={
            <div style={{ 
                minHeight: '100vh', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                background: 'radial-gradient(ellipse at top left, #1e3a5f 0%, #0f172a 50%, #0a1628 100%)',
                color: '#fff'
            }}>
                Yükleniyor...
            </div>
        }>
            <LoginContent />
        </Suspense>
    );
}
