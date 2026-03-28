import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

export async function updateSession(request) {
    let supabaseResponse = NextResponse.next({ request });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    );
                    supabaseResponse = NextResponse.next({ request });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    const { pathname } = request.nextUrl;

    // MAINTENANCE MODE CHECK
    const IS_MAINTENANCE = false; // Set to false to disable
    
    // Public paths that should always be accessible
    const publicPaths = [
        '/auth/callback',
        '/pwa-icon.png',
        '/omi-logo.png',
        '/favicon.ico',
        '/manifest.json',
        '/sw.js',
        '/_next',
        '/api/auth'
    ];
    
    const isPublicAsset = publicPaths.some((p) => pathname.startsWith(p)) || 
                         pathname.match(/\.(png|jpg|jpeg|gif|webp|svg|css|js|ico)$/);

    if (IS_MAINTENANCE && !isPublicAsset) {
        if (pathname === '/login') {
            return supabaseResponse; // Allow the login page without further processing
        }
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        url.searchParams.set('maintenance', 'true');
        return NextResponse.redirect(url);
    }

    console.log('[MW] pathname:', pathname, '| user:', user?.email ?? 'none', '| userError:', userError?.message ?? 'none');

    if (user) {
        // Check company approval status for non-admin users
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('is_admin, company:companies(status)')
            .eq('id', user.id)
            .single();

        console.log('[MW] profile:', JSON.stringify(profile), '| profileError:', profileError?.message ?? 'none');

        if (profile) {
            const isAdmin = profile.is_admin;
            const companyStatus = profile.company?.status;

            // Admin trying to access non-admin page — redirect to admin
            // EXCEPT if they are impersonating a company (Showroom mode)
            const impersonatedId = request.cookies.get('impersonate_company_id')?.value;
            const isImpersonating = isAdmin && impersonatedId && impersonatedId !== 'undefined';

            if (isAdmin && pathname === '/dashboard' && !isImpersonating) {
                const url = request.nextUrl.clone();
                url.pathname = '/admin';
                return NextResponse.redirect(url);
            }

            // Non-admin accessing admin area
            if (!isAdmin && pathname.startsWith('/admin')) {
                const url = request.nextUrl.clone();
                url.pathname = '/dashboard';
                return NextResponse.redirect(url);
            }

            // Firm not yet approved
            if (!isAdmin && companyStatus !== 'approved' && !pathname.startsWith('/pending')) {
                console.log('[MW] Company not approved → redirect /pending | status:', companyStatus);
                const url = request.nextUrl.clone();
                url.pathname = '/pending';
                return NextResponse.redirect(url);
            }

            // Logged in user on login/register → redirect
            const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/register');
            if (isAuthPage) {
                const url = request.nextUrl.clone();
                url.pathname = isAdmin ? '/admin' : '/dashboard';
                return NextResponse.redirect(url);
            }
        } else {
            console.log('[MW] Profile not found for user:', user.id);
        }
    }

    return supabaseResponse;
}
