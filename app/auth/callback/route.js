import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export async function GET(request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get('code');

    if (code) {
        const supabase = await createClient();
        await supabase.auth.exchangeCodeForSession(code);
    }

    return redirect(`${origin}/dashboard`);
}
