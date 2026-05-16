import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { checkAndTriggerSync } from '../internal_trigger';

export async function updateSession(request) {
    let supabaseResponse = NextResponse.next({ request });

    // 🚀 FAIL-SAFE: Trigger internal sync check (fire and forget)
    // Bu işlem her isteğin başında çok hızlıca veritabanına bakacak,
    // eğer bugün henüz güncelleme yapılmadıysa arka planda başlatacak.
    if (!request.nextUrl.pathname.startsWith('/_next')) {
        checkAndTriggerSync().catch(console.error);
    }

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
            cookies: {
                getAll() { return request.cookies.getAll(); },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
                    supabaseResponse = NextResponse.next({ request });
                    cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
                },
            },
        }
    );

    const { data: { user } } = await supabase.auth.getUser();
    const { pathname } = request.nextUrl;

    const isPublicFile = pathname.startsWith('/_next') || pathname.startsWith('/api/auth') || pathname.match(/\.(png|jpg|ico|svg|json|js|webmanifest)$/);
    if (isPublicFile) return supabaseResponse;

    // Define public routes that don't require authentication
    const publicRoutes = [
        '/login', 
        '/register', 
        '/hakkimizda', 
        '/mesafeli-satis-sozlesmesi', 
        '/iptal-ve-iade-kosullari', 
        '/gizlilik-ve-guvenlik',
        '/api/payment/qnb/callback',
        '/api/cron/sync-xml' // Cron job yolu public olmalı
    ];
    
    const isPublicRoute = publicRoutes.includes(pathname);

    if (!user) {
        if (!isPublicRoute) {
            // Check if there is an expired/invalid auth cookie
            const allCookies = request.cookies.getAll();
            const authCookie = allCookies.find(c => c.name.endsWith('-auth-token.0') || c.name.endsWith('-auth-token'));
            
            if (authCookie) {
                // Trigger the expiration log in the background
                try {
                    fetch(`${request.nextUrl.origin}/api/auth/log-expiration`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ cookie: authCookie.value })
                    }).catch(() => {});
                } catch (e) {}

                // Clear all auth token chunks to prevent duplicate logs
                allCookies.forEach(c => {
                    if (c.name.includes('-auth-token')) {
                        supabaseResponse.cookies.delete(c.name);
                    }
                });
            }

            const url = request.nextUrl.clone();
            url.pathname = '/login';
            return NextResponse.redirect(url);
        }
        return supabaseResponse;
    }

    // --- Showroom / Impersonation Check (CRITICAL) ---
    const impCookie = request.cookies.get('impersonate_company_id');
    const isImpersonating = impCookie && impCookie.value !== 'undefined' && impCookie.value !== '';

    // If showroom is active, allow all dealer paths and API calls immediately
    const isDealerPath = pathname.startsWith('/dashboard') || pathname.startsWith('/pending') || pathname.startsWith('/api/user');
    if (isImpersonating && (isDealerPath || pathname.startsWith('/rep/showroom'))) {
        return supabaseResponse;
    }

    // --- Identification ---
    const isRep = user.user_metadata?.role === 'representative';
    const { data: profile } = await supabase.from('profiles').select('is_admin, company:companies(status)').eq('id', user.id).maybeSingle();
    const isAdmin = profile?.is_admin || isRep; // TREAT REP AS ADMIN FOR AUTH PURPOSES

    // 1. Redirect away from auth pages if logged in
    if (pathname === '/login' || pathname === '/register') {
        const url = request.nextUrl.clone();
        url.pathname = isRep ? '/rep' : (isAdmin ? '/admin' : '/dashboard');
        return NextResponse.redirect(url);
    }

    // 2. PRIVILEGED RULES (Admin & Rep)
    if (isAdmin || isRep) {
        // Showroom mode check
        const impCookie = request.cookies.get('impersonate_company_id');
        const isImpersonating = impCookie && impCookie.value !== 'undefined' && impCookie.value !== '';

        if (pathname.startsWith('/dashboard') && !isImpersonating) {
            const url = request.nextUrl.clone();
            url.pathname = isRep ? '/rep' : '/admin';
            return NextResponse.redirect(url);
        }
        return supabaseResponse;
    }

    // 4. DEALER RULES
    if (profile) {
        const companyStatus = profile.company?.status;
        if (pathname.startsWith('/admin') || pathname.startsWith('/rep')) {
            const url = request.nextUrl.clone();
            url.pathname = '/dashboard';
            return NextResponse.redirect(url);
        }
        if (companyStatus !== 'approved' && !pathname.startsWith('/pending')) {
            const url = request.nextUrl.clone();
            url.pathname = '/pending';
            return NextResponse.redirect(url);
        }
    }

    return supabaseResponse;
}
