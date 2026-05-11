import Sidebar from '@/components/Sidebar';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function RepLayout({ children }) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) redirect('/login');

    const isRep = user.user_metadata?.role === 'representative';
    
    if (!isRep) {
        const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
        if (!profile?.is_admin) redirect('/login');
    }

    const userName = user.user_metadata?.full_name || 'Temsilci';

    return (
        <div className="app-layout" style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-canvas)' }}>
            <Sidebar isAdmin={false} companyName={userName} userEmail={user.email} isRep={true} />
            <main className="main-content" style={{ 
                height: '100vh',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
            }}>
                {children}
            </main>
        </div>
    );
}
