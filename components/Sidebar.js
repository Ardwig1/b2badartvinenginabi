'use client';
import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useTheme } from '@/components/ThemeProvider';
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
    { label: 'Online Ödeme', href: '/dashboard/payment', icon: '💳' },
    { label: 'Dosyalar', href: '/dashboard/files', icon: '📁' },
    { label: 'Banka Bilgileri', href: '/dashboard/bank-accounts', icon: '🏦' },
    { label: 'İletişim', href: '/dashboard/contact', icon: '📞' },
];

export default function Sidebar({ isAdmin = false, companyName = '', userEmail = '' }) {
    const [isOpen, setIsOpen] = useState(true);
    const { theme, toggleTheme, mounted } = useTheme();
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
        <aside className={`${styles.sidebar} ${!isOpen ? styles.collapsed : ''}`}>
            {/* Logo */}
            <div className={styles.logo}>
                <span className={styles.logoIcon}>⚙️</span>
                {isOpen && (
                    <div>
                        <div className={styles.logoText}>B2B Parça</div>
                        <div className={styles.logoSub}>{isAdmin ? 'Admin Paneli' : 'Bayi Paneli'}</div>
                    </div>
                )}
                <button className={styles.collapseBtn} onClick={() => setIsOpen(!isOpen)} title={isOpen ? "Menüyü Daralt" : "Menüyü Genişlet"}>
                    {isOpen ? '◀' : '▶'}
                </button>
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
                            {isOpen && <span>{item.label}</span>}
                        </a>
                    );
                })}
            </nav>

            {/* Theme & User Info */}
            <div className={styles.userSection}>
                {mounted && (
                    <button className={styles.themeToggle} onClick={toggleTheme} title="Görünümü Değiştir">
                        {theme === 'dark' ? '☀️ Aydınlık Mod' : '🌙 Karanlık Mod'}
                    </button>
                )}
                <div className={styles.userInfo}>
                    <div className={styles.userAvatar}>
                        {(companyName || userEmail || '?')[0].toUpperCase()}
                    </div>
                    {isOpen && (
                        <div className={styles.userDetails}>
                            <div className={styles.userName}>{companyName || 'Admin'}</div>
                            <div className={styles.userEmail}>{userEmail}</div>
                        </div>
                    )}
                </div>
                <button className={styles.signOutBtn} onClick={handleSignOut} id="sidebar-signout" title="Çıkış Yap">
                    🚪 {isOpen && 'Çıkış'}
                </button>
            </div>
        </aside>
    );
}
