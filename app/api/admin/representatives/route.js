import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/auth/admin';

export async function POST(req) {
    try {
        const user = await verifyAdmin();
        if (!user) return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });

        const { first_name, last_name, tc_no, phone, email, position, dealer_code, user_code, password, assigned_companies } = await req.json();

        const adminSupabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY,
            { auth: { autoRefreshToken: false, persistSession: false } }
        );

        // 1. Create Auth User
        const { data: authUser, error: authError } = await adminSupabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { role: 'representative', full_name: `${first_name} ${last_name}` }
        });

        if (authError) throw authError;

        // 2. Create Representative Record
        const { data: rep, error: repError } = await adminSupabase
            .from('customer_representatives')
            .insert([{
                id: authUser.user.id, // Use same ID as Auth
                first_name,
                last_name,
                tc_no,
                phone,
                email,
                position,
                dealer_code,
                user_code,
                password // Storing plain password is NOT recommended for production, but following your schema
            }])
            .select()
            .single();

        if (repError) {
            // Rollback auth user if DB record fails
            await adminSupabase.auth.admin.deleteUser(authUser.user.id);
            throw repError;
        }

        // 3. Create Assignments
        if (assigned_companies && assigned_companies.length > 0) {
            const assignments = assigned_companies.map(cid => ({
                representative_id: rep.id,
                company_id: cid
            }));
            await adminSupabase.from('representative_assignments').insert(assignments);
        }

        return NextResponse.json({ success: true });

    } catch (err) {
        console.error('Rep Creation Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function DELETE(req) {
    try {
        const user = await verifyAdmin();
        if (!user) return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ error: 'ID eksik' }, { status: 400 });

        const adminSupabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY,
            { auth: { autoRefreshToken: false, persistSession: false } }
        );

        // 1. Delete from Auth (This also triggers table deletion if cascading, 
        // but we'll do both to be safe)
        const { error: authError } = await adminSupabase.auth.admin.deleteUser(id);
        
        // 2. Explicitly delete from table (in case ID mismatch or other issues)
        const { error: tableError } = await adminSupabase.from('customer_representatives').delete().eq('id', id);

        if (tableError) throw tableError;

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('Rep Deletion Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
