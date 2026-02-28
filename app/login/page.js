'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import styles from './auth.module.css';

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const supabase = createClient();
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });

        if (err) {
            setError(err.message === 'Invalid login credentials'
                ? 'E-posta veya şifre hatalı.'
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
                        <label className="form-label">E-posta</label>
                        <input
                            className="form-input"
                            type="email"
                            placeholder="firma@email.com"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                            id="login-email"
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

                <p className={styles.authLink}>
                    Hesabınız yok mu?{' '}
                    <a href="/register" style={{ color: 'var(--primary)', fontWeight: 600 }}>
                        Firma Kaydı
                    </a>
                </p>
            </div>
        </div>
    );
}
