import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js'; // Admin client for RLS bypass
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import Sidebar from '@/components/Sidebar';
import TopHeader from '@/components/TopHeader';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) redirect('/login');

    // 1. Identify User Type
    const isRep = user.user_metadata?.role === 'representative';
    const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin, full_name, company:companies(id, name, status)')
        .eq('id', user.id)
        .maybeSingle();

    const isAdmin = profile?.is_admin || false;

    // 2. Identify Showroom Context
    const cookieStore = await cookies();
    const impersonatedId = cookieStore.get('impersonate_company_id')?.value;
    const isImpersonating = (isAdmin || isRep) && impersonatedId && impersonatedId !== 'undefined' && impersonatedId !== '';

    // 3. Security Checks
    if (!isImpersonating) {
        if (profile?.company?.status !== 'approved' && !isAdmin && !isRep) redirect('/pending');
        if (isRep) redirect('/rep');
    }

    // 4. Fetch Company Info (Use Admin Client for Showroom to bypass RLS)
    let effectiveCompanyName = profile?.company?.name || '';
    let effectiveCompanyEmail = user.email; // Default to user's email

    if (isImpersonating) {
        const adminSupabase = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );
        const { data: impCompany } = await adminSupabase
            .from('companies')
            .select('name, email')
            .eq('id', impersonatedId)
            .maybeSingle();
        
        if (impCompany) {
            effectiveCompanyName = impCompany.name;
            if (impCompany.email) effectiveCompanyEmail = impCompany.email;
        }
    }

    return (
        <div className="app-layout" data-nested={isImpersonating}>
            <Sidebar 
                isAdmin={false} 
                isRep={isImpersonating ? false : isRep} 
                userEmail={effectiveCompanyEmail} 
                companyName={effectiveCompanyName} 
                isImpersonated={isImpersonating} 
            />
            <script dangerouslySetInnerHTML={{ __html: `localStorage.setItem('storedCompanyName', '${(effectiveCompanyName || '').replace(/'/g, "\\'")}');` }} />
            <main className="main-content">
                <TopHeader />
                <div style={{ padding: '0 24px' }}>
                    {children}
                </div>
            </main>
        </div>
    );
}
