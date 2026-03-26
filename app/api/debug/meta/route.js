import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        const { data, error } = await supabase
            .from('companies')
            .select('*')
            .limit(1);

        if (error) throw error;

        return NextResponse.json({ 
            columns: data && data.length > 0 ? Object.keys(data[0]) : [],
            sample: data ? data[0] : null
        });
    } catch (e) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
