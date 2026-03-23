import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import TopHeader from '@/components/TopHeader';

export default async function DashboardLayout({ children }) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) redirect('/login');

    const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin, full_name, company:companies(name, status)')
        .eq('id', user.id)
        .single();

    if (profile?.is_admin) redirect('/admin');
    if (profile?.company?.status !== 'approved') redirect('/pending');

    return (
        <div className="app-layout">
            <Sidebar isAdmin={false} userEmail={user.email} companyName={profile?.company?.name || ''} />
            <script dangerouslySetInnerHTML={{ __html: `localStorage.setItem('storedCompanyName', '${(profile?.company?.name || '').replace(/'/g, "\\'")}');` }} />
            <main className="main-content">
                <TopHeader />
                <div style={{ padding: '0 24px' }}>
                    {children}
                </div>
            </main>
        </div>
    );
}
