'use client';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import styles from './Sidebar.module.css';

const adminNav = [
    { label: 'Dashboard', href: '/admin', icon: '📊' },
    { label: 'Firmalar', href: '/admin/companies', icon: '🏢' },
    { label: 'Ürünler & Stok', href: '/admin/products', icon: '📦' },
    { label: 'Fiyat Grupları', href: '/admin/price-groups', icon: '🏷️' },
    { label: 'Siparişler', href: '/admin/orders', icon: '🛒' },
    { label: 'Teklifler', href: '/admin/quotes', icon: '📋' },
    { label: 'Faturalar', href: '/admin/invoices', icon: '🧾' },
];

const dealerNav = [
    { label: 'Ana Sayfa', href: '/dashboard', icon: '🏠' },
    { label: 'Ürün Arama', href: '/dashboard/catalog', icon: '🔍' },
    { label: 'Sepetim', href: '/dashboard/cart', icon: '🛒' },
    { label: 'Siparişlerim', href: '/dashboard/orders', icon: '📋' },
    { label: 'Tekliflerim', href: '/dashboard/quotes', icon: '💬' },
    { label: 'Faturalarım / Ödemelerim', href: '/dashboard/invoices', icon: '🧾' },
];

export default function Sidebar({ isAdmin = false, companyName = '', userEmail = '' }) {
    const pathname = usePathname();
    const router = useRouter();
    const navItems = isAdmin ? adminNav : dealerNav;

    const handleSignOut = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push('/login');
        router.refresh();
    };

    return (
        <aside className={styles.sidebar}>
            {/* Logo */}
            <div className={styles.logo}>
                <span className={styles.logoIcon}>⚙️</span>
                <div>
                    <div className={styles.logoText}>B2B Parça</div>
                    <div className={styles.logoSub}>{isAdmin ? 'Admin Paneli' : 'Bayi Paneli'}</div>
                </div>
            </div>

            {/* Navigation */}
            <nav className={styles.nav}>
                {navItems.map((item) => {
                    const isActive = item.href === '/admin' || item.href === '/dashboard'
                        ? pathname === item.href
                        : pathname.startsWith(item.href);
                    return (
                        <a
                            key={item.href}
                            href={item.href}
                            className={`${styles.navItem} ${isActive ? styles.active : ''}`}
                        >
                            <span className={styles.navIcon}>{item.icon}</span>
                            <span>{item.label}</span>
                        </a>
                    );
                })}
            </nav>

            {/* User Info */}
            <div className={styles.userSection}>
                <div className={styles.userInfo}>
                    <div className={styles.userAvatar}>
                        {(companyName || userEmail || '?')[0].toUpperCase()}
                    </div>
                    <div className={styles.userDetails}>
                        <div className={styles.userName}>{companyName || 'Admin'}</div>
                        <div className={styles.userEmail}>{userEmail}</div>
                    </div>
                </div>
                <button className={styles.signOutBtn} onClick={handleSignOut} id="sidebar-signout">
                    🚪 Çıkış
                </button>
            </div>
        </aside>
    );
}
