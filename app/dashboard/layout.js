import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import Sidebar from '@/components/Sidebar';
import TopHeader from '@/components/TopHeader';

export default async function DashboardLayout({ children }) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) redirect('/login');

    const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin, full_name, company:companies(id, name, status)')
        .eq('id', user.id)
        .single();

    const cookieStore = await cookies();
    const impersonatedId = cookieStore.get('impersonate_company_id')?.value;
    const isImpersonating = profile?.is_admin && impersonatedId;

    if (profile?.is_admin && !isImpersonating) redirect('/admin');
    if (!isImpersonating && profile?.company?.status !== 'approved') redirect('/pending');

    // If impersonating, we might want to fetch that company's name for the sidebar
    let effectiveCompanyName = profile?.company?.name || '';
    if (isImpersonating) {
        const impId = cookieStore.get('impersonate_company_id')?.value;
        const { data: impCompany } = await supabase.from('companies').select('name').eq('id', impId).single();
        if (impCompany) effectiveCompanyName = impCompany.name;
    }

    return (
        <div className="app-layout" data-nested={isImpersonating}>
            <Sidebar isAdmin={false} userEmail={user.email} companyName={effectiveCompanyName} isImpersonated={isImpersonating} />
            <script dangerouslySetInnerHTML={{ __html: `localStorage.setItem('storedCompanyName', '${(effectiveCompanyName).replace(/'/g, "\\'")}');` }} />
            <main className="main-content">
                <TopHeader />
                <div style={{ padding: '0 24px' }}>
                    {children}
                </div>
            </main>
        </div>
    );
}
