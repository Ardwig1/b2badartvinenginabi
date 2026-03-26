import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: updateData, error: updateError } = await supabase
        .from('companies')
        .update({ is_prepayment_locked: true })
        .eq('id', '21d36240-e51f-4504-bc78-e44933cc1691')
        .select();

    return NextResponse.json({ updateData, updateError });
}
