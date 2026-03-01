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
    const { companyName, taxNumber, contactPerson, phone, address, email, password } = body;

    const adminSupabase = await getAdminClient();

    const { data: newUser, error: createErr } = await adminSupabase.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { full_name: contactPerson }
    });
    if (createErr) return NextResponse.json({ error: createErr.message }, { status: 400 });

    const { data: company, error: companyErr } = await adminSupabase
        .from('companies')
        .insert({ name: companyName, tax_number: taxNumber, contact_person: contactPerson, phone, address, email, status: 'approved' })
        .select().single();

    if (companyErr) {
        await adminSupabase.auth.admin.deleteUser(newUser.user.id);
        return NextResponse.json({ error: 'Firma oluşturulamadı: ' + companyErr.message }, { status: 400 });
    }

    // 3. Link profile → company
    // Trigger might not have created the profile yet, so we retry up to 3 times then upsert
    let profileLinked = false;
    for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) await new Promise(r => setTimeout(r, 500));
        const { count } = await adminSupabase
            .from('profiles')
            .update({ company_id: company.id, full_name: contactPerson })
            .eq('id', newUser.user.id)
            .select('id', { count: 'exact', head: true });
        if (count > 0) { profileLinked = true; break; }
    }
    if (!profileLinked) {
        // Profile not created by trigger yet — upsert
        await adminSupabase
            .from('profiles')
            .upsert({ id: newUser.user.id, company_id: company.id, full_name: contactPerson, is_admin: false });
    }

    return NextResponse.json({ success: true, company });
}

// PATCH — Durum veya fiyat grubu güncelle
export async function PATCH(request) {
    const user = await verifyAdmin();
    if (!user) return NextResponse.json({ error: 'Yetkisiz.' }, { status: 401 });

    const { id, status, price_group_id } = await request.json();
    const adminSupabase = await getAdminClient();
    const updates = {};
    if (status !== undefined) updates.status = status;
    if (price_group_id !== undefined) updates.price_group_id = price_group_id || null;

    const { error } = await adminSupabase.from('companies').update(updates).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
}
