import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import AdminCurrencyHeader from '@/components/AdminCurrencyHeader';

export default async function AdminLayout({ children }) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) redirect('/login');

    const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin, full_name')
        .eq('id', user.id)
        .single();

    if (!profile?.is_admin) redirect('/dashboard');

    return (
        <div className="app-layout">
            <Sidebar isAdmin={true} userEmail={user.email} companyName={profile.full_name || 'Admin'} />
            <AdminCurrencyHeader />
            <main className="main-content">
                {children}
            </main>
        </div>
    );
}
