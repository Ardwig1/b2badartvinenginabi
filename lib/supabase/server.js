import { createServerClient } from '@supabase/ssr';
import { cookies, headers } from 'next/headers';

export async function createClient() {
    // Mobil uygulama (Android) için Bearer Token desteği ekliyoruz
    const headersList = await headers();
    const authHeader = headersList.get('authorization');

    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        return createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
            {
                global: {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                },
                cookies: {
                    getAll() { return []; },
                    setAll() { },
                },
            }
        );
    }

    const cookieStore = await cookies();
    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        );
                    } catch {
                        // Server components can't set cookies — handled by middleware
                    }
                },
            },
        }
    );
}
