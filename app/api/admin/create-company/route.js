import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

async function getAdminClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );
}

async function verifyAdmin() {
    const cookieStore = await cookies();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
            cookies: {
                getAll() { return cookieStore.getAll(); },
                setAll(cookiesToSet) {
                    try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch { }
                },
            },
        }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
    return profile?.is_admin ? user : null;
}

// GET — Tüm firmaları listele
export async function GET(request) {
    const user = await verifyAdmin();
    if (!user) return NextResponse.json({ error: 'Yetkisiz.' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter');
    const adminSupabase = await getAdminClient();

    let query = adminSupabase.from('companies').select('*, price_group:price_groups(name)').order('created_at', { ascending: false });
    if (filter && filter !== 'all') query = query.eq('status', filter);

    const { data, error } = await query;
    const { data: priceGroups } = await adminSupabase.from('price_groups').select('*');

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ companies: data || [], priceGroups: priceGroups || [] });
}

// POST — Yeni firma ekle
export async function POST(request) {
    const user = await verifyAdmin();
    if (!user) return NextResponse.json({ error: 'Yetkisiz.' }, { status: 401 });

    const body = await request.json();
    const {
        companyName, taxNumber, contactPerson, phone, address, email, password,
        taxOffice, city, district, branch, dealerCode, userCode
    } = body;

    const adminSupabase = await getAdminClient();

    // 1. Create Auth User
    const { data: newUser, error: createErr } = await adminSupabase.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { full_name: contactPerson }
    });
    if (createErr) return NextResponse.json({ error: createErr.message }, { status: 400 });

    // 2. Create Company
    const { data: company, error: companyErr } = await adminSupabase
        .from('companies')
        .insert({
            name: companyName, tax_number: taxNumber, contact_person: contactPerson,
            phone, address, email, status: 'approved',
            tax_office: taxOffice, city, district, branch, dealer_code: dealerCode, user_code: userCode
        })
        .select().single();

    if (companyErr) {
        await adminSupabase.auth.admin.deleteUser(newUser.user.id);
        return NextResponse.json({ error: 'Firma oluşturulamadı: ' + companyErr.message }, { status: 400 });
    }

    // 3. Link profile → company (Upsert immediately since trigger might be slow or missing)
    const { error: profErr } = await adminSupabase
        .from('profiles')
        .upsert({ id: newUser.user.id, company_id: company.id, full_name: contactPerson, is_admin: false });

    if (profErr) {
        console.error("Profile linking error:", profErr);
    }

    return NextResponse.json({ success: true, company });
}

// PATCH — Durum veya fiyat grubu güncelle
export async function PATCH(request) {
    const user = await verifyAdmin();
    if (!user) return NextResponse.json({ error: 'Yetkisiz.' }, { status: 401 });

    const { id, status, price_group_id, password, user_code, dealer_code, is_prepayment_locked, risk_limit } = await request.json();
    const adminSupabase = await getAdminClient();
    const updates = {};
    if (status !== undefined) updates.status = status;
    if (price_group_id !== undefined) updates.price_group_id = price_group_id || null;
    if (user_code !== undefined) updates.user_code = user_code;
    if (dealer_code !== undefined) updates.dealer_code = dealer_code;
    if (is_prepayment_locked !== undefined) updates.is_prepayment_locked = is_prepayment_locked;
    if (risk_limit !== undefined) updates.risk_limit = risk_limit;

    // Update company table
    if (Object.keys(updates).length > 0) {
        const { error } = await adminSupabase.from('companies').update(updates).eq('id', id);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // If password needs updating, find user and update
    if (password && password.trim().length >= 6) {
        const { data: profileList } = await adminSupabase.from('profiles').select('id').eq('company_id', id);
        if (profileList && profileList.length > 0) {
            for (const profile of profileList) {
                await adminSupabase.auth.admin.updateUserById(profile.id, { password: password.trim() });
            }
        }
    }

    return NextResponse.json({ success: true });
}

// DELETE — Firmayı ve kullanıcısını tamamen sil
export async function DELETE(request) {
    const user = await verifyAdmin();
    if (!user) return NextResponse.json({ error: 'Yetkisiz.' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Firma ID gerekli.' }, { status: 400 });

    const adminSupabase = await getAdminClient();

    // 1. Delete associated users from Auth
    const { data: profiles } = await adminSupabase.from('profiles').select('id').eq('company_id', id);
    if (profiles && profiles.length > 0) {
        for (const p of profiles) {
            await adminSupabase.auth.admin.deleteUser(p.id);
        }
    }

    // 2. Delete company (profiles and activities should cascade, but company is the root)
    const { error } = await adminSupabase.from('companies').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ success: true });
}
