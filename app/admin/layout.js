import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';
import { headers, cookies } from 'next/headers';
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

    const headersList = await headers();
    const pathname = headersList.get('x-invoke-path') || '';
    const isShowroom = pathname.includes('/admin/showroom/');

    return (
        <div className="app-layout">
            <Sidebar isAdmin={true} userEmail={user.email} companyName={profile.full_name || 'Admin'} />
            {!isShowroom && <AdminCurrencyHeader />}
            <main className="main-content" style={{ padding: isShowroom ? 0 : undefined }}>
                {children}
            </main>
        </div>
    );
}
