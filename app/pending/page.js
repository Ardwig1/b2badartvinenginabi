import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import styles from '../login/auth.module.css';

export default async function PendingPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) redirect('/login');

    const { data: profile } = await supabase
        .from('profiles')
        .select('company:companies(status, name)')
        .eq('id', user.id)
        .single();

    const status = profile?.company?.status;
    if (status === 'approved') redirect('/dashboard');
    if (!status) redirect('/login');

    const handleSignOut = async () => {
        'use server';
        const supabase = await createClient();
        await supabase.auth.signOut();
        redirect('/login');
    };

    return (
        <div className={styles.authBg}>
            <div className={styles.authCard} style={{ textAlign: 'center' }}>
                {status === 'rejected' ? (
                    <>
                        <div style={{ fontSize: 64, marginBottom: 16 }}>❌</div>
                        <h2 className={styles.authTitle}>Başvurunuz Reddedildi</h2>
                        <p className={styles.authDesc} style={{ marginBottom: 24 }}>
                            Maalesef firma başvurunuz reddedildi. Daha fazla bilgi için bizimle iletişime geçin.
                        </p>
                    </>
                ) : (
                    <>
                        <div style={{ fontSize: 64, marginBottom: 16 }}>⏳</div>
                        <h2 className={styles.authTitle}>Onay Bekleniyor</h2>
                        <p className={styles.authDesc} style={{ marginBottom: 8 }}>
                            <strong style={{ color: 'var(--text-primary)' }}>{profile?.company?.name}</strong>
                        </p>
                        <p className={styles.authDesc} style={{ marginBottom: 24 }}>
                            Firma kaydınız yönetici tarafından inceleniyor. Onaylandığında hesabınıza erişebileceksiniz.
                        </p>
                    </>
                )}
                <form action={handleSignOut}>
                    <button type="submit" className="btn btn-ghost">Çıkış Yap</button>
                </form>
            </div>
        </div>
    );
}
