import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js'; // Admin client for RLS bypass
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import Sidebar from '@/components/Sidebar';
import TopHeader from '@/components/TopHeader';
import MaintenanceGate from '@/components/MaintenanceGate';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) redirect('/login');

    const adminSupabase = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 1. Identify User Type
    const isRep = user.user_metadata?.role === 'representative';
    const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin, full_name, company:companies(id, name, status)')
        .eq('id', user.id)
        .maybeSingle();

    const isAdmin = profile?.is_admin || false;

    // 2. Fetch Maintenance Settings
    const { data: settingsData } = await adminSupabase
        .from('site_settings')
        .select('setting_value')
        .eq('setting_key', 'maintenance_mode')
        .maybeSingle();
    
    const maintenanceSettings = settingsData?.setting_value || {};

    // 3. Identify Showroom Context
    const cookieStore = await cookies();
    const impersonatedId = cookieStore.get('impersonate_company_id')?.value;
    const isImpersonating = (isAdmin || isRep) && impersonatedId && impersonatedId !== 'undefined' && impersonatedId !== '';

    // 4. Security Checks
    if (!isImpersonating) {
        if (profile?.company?.status !== 'approved' && !isAdmin && !isRep) redirect('/pending');
        if (isRep) redirect('/rep');
    }

    // 5. Fetch Company Info
    let effectiveCompanyName = profile?.company?.name || '';
    let effectiveCompanyEmail = user.email;

    if (isImpersonating) {
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
                    <MaintenanceGate maintenanceSettings={maintenanceSettings}>
                        {children}
                    </MaintenanceGate>
                </div>
            </main>
        </div>
    );
}
