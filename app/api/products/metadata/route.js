import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

async function getEffectiveCompanyId() {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        const adminSupabase = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
        const { data: profile } = await adminSupabase.from('profiles').select('is_admin, company_id').eq('id', user.id).maybeSingle();

        const cookieStore = await cookies();
        const impId = cookieStore.get('impersonate_company_id')?.value;
        const isImpersonating = impId && impId !== 'undefined' && impId !== '';

        if (isImpersonating) {
            const isRepMetadata = user.user_metadata?.role === 'representative';
            const { data: repAssignment } = await adminSupabase
                .from('representative_assignments')
                .select('representative_id')
                .eq('representative_id', user.id)
                .limit(1)
                .maybeSingle();
            const isRep = isRepMetadata || !!repAssignment;
            if (profile?.is_admin || isRep) return impId;
        }
        return profile?.company_id;
    } catch (e) {
        return null;
    }
}

export async function GET(request) {
    try {
        const companyId = await getEffectiveCompanyId();
        if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const carBrand = searchParams.get('carBrand');

        const adminSupabase = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        if (carBrand) {
            const { data, error } = await adminSupabase
                .from('products')
                .select('car_model')
                .eq('car_brand', carBrand)
                .eq('is_active', true);
            
            if (error) throw error;
            const carModels = [...new Set(data.map(p => p.car_model).filter(Boolean))].sort();
            return NextResponse.json({ carModels });
        }

        const { data, error } = await adminSupabase
            .from('products')
            .select('brand, car_brand')
            .eq('is_active', true);

        if (error) throw error;

        const brands = [...new Set(data.map(p => p.brand).filter(Boolean))].sort();
        const carBrands = [...new Set(data.map(p => p.car_brand).filter(Boolean))].sort();

        return NextResponse.json({
            brands,
            carBrands
        });
    } catch (err) {
        console.error("PRODUCTS METADATA API ERROR:", err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
