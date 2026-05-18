import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

async function verifyRepAndCompany(repId, companyId) {
    const adminSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const { data } = await adminSupabase
        .from('representative_assignments')
        .select('company_id')
        .eq('representative_id', repId)
        .eq('company_id', companyId)
        .maybeSingle();
    return !!data;
}

export async function PATCH(request) {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Yetkisiz.' }, { status: 401 });

    const isRep = user.user_metadata?.role === 'representative';
    if (!isRep) return NextResponse.json({ error: 'Sadece temsilciler bu endpoint\'i kullanabilir.' }, { status: 403 });

    const body = await request.json();
    const { id, name, tax_number, tax_office, contact_person, phone, city, district, address, branch, is_prepayment_locked, risk_limit } = body;

    if (!id) return NextResponse.json({ error: 'Firma ID gerekli.' }, { status: 400 });

    const hasAccess = await verifyRepAndCompany(user.id, id);
    if (!hasAccess) return NextResponse.json({ error: 'Bu firmaya erişim yetkiniz yok.' }, { status: 403 });

    const adminSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (tax_number !== undefined) updates.tax_number = tax_number;
    if (tax_office !== undefined) updates.tax_office = tax_office;
    if (contact_person !== undefined) updates.contact_person = contact_person;
    if (phone !== undefined) updates.phone = phone;
    if (city !== undefined) updates.city = city;
    if (district !== undefined) updates.district = district;
    if (address !== undefined) updates.address = address;
    if (branch !== undefined) updates.branch = branch;
    if (is_prepayment_locked !== undefined) updates.is_prepayment_locked = is_prepayment_locked;
    if (risk_limit !== undefined) updates.risk_limit = risk_limit;

    if (Object.keys(updates).length === 0) return NextResponse.json({ success: true });

    const { error } = await adminSupabase.from('companies').update(updates).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ success: true });
}
