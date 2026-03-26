import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: company, error } = await supabase
        .from('companies')
        .select('name, is_prepayment_locked')
        .eq('id', '21d36240-e51f-4504-bc78-e44933cc1691')
        .single();

    return NextResponse.json({ company, error });
}
