'use client';
import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useTheme } from '@/components/ThemeProvider';
import {
    ChartBarIcon, BuildingOfficeIcon, CubeIcon, CurrencyDollarIcon, ShoppingCartIcon,
    ClipboardDocumentListIcon, DocumentTextIcon, HomeIcon, MagnifyingGlassIcon,
    ChatBubbleLeftEllipsisIcon, CreditCardIcon, FolderOpenIcon, BuildingLibraryIcon,
    EnvelopeIcon, PhoneIcon, SunIcon, MoonIcon, ArrowRightOnRectangleIcon, ChevronDoubleLeftIcon, ChevronDoubleRightIcon,
    Cog6ToothIcon
} from '@heroicons/react/24/outline';
import styles from './Sidebar.module.css';

const adminNav = [
    { label: 'Dashboard', href: '/admin', icon: <ChartBarIcon style={{ width: 20, height: 20 }} /> },
    { label: 'Firmalar', href: '/admin/companies', icon: <BuildingOfficeIcon style={{ width: 20, height: 20 }} /> },
    { label: 'Ürünler & Stok', href: '/admin/products', icon: <CubeIcon style={{ width: 20, height: 20 }} /> },
    { label: 'Fiyat Grupları', href: '/admin/price-groups', icon: <CurrencyDollarIcon style={{ width: 20, height: 20 }} /> },
    { label: 'Siparişler', href: '/admin/orders', icon: <ShoppingCartIcon style={{ width: 20, height: 20 }} /> },
    { label: 'Cari Hareketler', href: '/admin/account', icon: <CurrencyDollarIcon style={{ width: 20, height: 20 }} /> },
    { label: 'Faturalar', href: '/admin/invoices', icon: <DocumentTextIcon style={{ width: 20, height: 20 }} /> },
    { label: 'Kullanıcı Önerileri', href: '/admin/suggestions', icon: <EnvelopeIcon style={{ width: 20, height: 20 }} /> },
];

const dealerNav = [
    { label: 'Ana Sayfa', href: '/dashboard', icon: <HomeIcon style={{ width: 20, height: 20 }} /> },
    { label: 'Ürün Arama', href: '/dashboard/catalog', icon: <MagnifyingGlassIcon style={{ width: 20, height: 20 }} /> },
    { label: 'Sepetim', href: '/dashboard/cart', icon: <ShoppingCartIcon style={{ width: 20, height: 20 }} /> },
    { label: 'Siparişlerim', href: '/dashboard/orders', icon: <ClipboardDocumentListIcon style={{ width: 20, height: 20 }} /> },
    { label: 'Cari Hesap', href: '/dashboard/account', icon: <CurrencyDollarIcon style={{ width: 20, height: 20 }} /> },
    { label: 'Faturalarım', href: '/dashboard/invoices', icon: <DocumentTextIcon style={{ width: 20, height: 20 }} /> },
    { label: 'Online Ödeme', href: '/dashboard/payment', icon: <CreditCardIcon style={{ width: 20, height: 20 }} /> },
    { label: 'Banka Bilgileri', href: '/dashboard/bank-accounts', icon: <BuildingLibraryIcon style={{ width: 20, height: 20 }} /> },
    { label: 'Öneri ve Şikayet', href: '/dashboard/suggestions', icon: <EnvelopeIcon style={{ width: 20, height: 20 }} /> },
    { label: 'İletişim', href: '/dashboard/contact', icon: <PhoneIcon style={{ width: 20, height: 20 }} /> },
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
                <div className={styles.logoImageContainer}>
                    <img src="/omi-logo-sidebar.png" alt="B2B Logo" style={{ width: '40px', height: '40px', objectFit: 'contain', borderRadius: '8px' }} onError={(e) => { e.target.onerror = null; e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }} />
                    <span className={styles.logoIcon} style={{ display: 'none' }}><Cog6ToothIcon style={{ width: 24, height: 24 }} /></span>
                </div>
                {isOpen && (
                    <div>
                        <div className={styles.logoText}>OMİ GROUP'S</div>
                        <div className={styles.logoSub}>{isAdmin ? 'Admin Paneli' : 'B2B Bayi Paneli'}</div>
                    </div>
                )}
                <button className={styles.collapseBtn} onClick={() => setIsOpen(!isOpen)} title={isOpen ? "Menüyü Daralt" : "Menüyü Genişlet"}>
                    {isOpen ? <ChevronDoubleLeftIcon style={{ width: 14, height: 14 }} /> : <ChevronDoubleRightIcon style={{ width: 14, height: 14 }} />}
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
                        {theme === 'dark' ? <><SunIcon style={{ width: 16, height: 16, marginRight: 6 }} /> Aydınlık Mod</> : <><MoonIcon style={{ width: 16, height: 16, marginRight: 6 }} /> Karanlık Mod</>}
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
                    <ArrowRightOnRectangleIcon style={{ width: 20, height: 20, marginRight: isOpen ? 6 : 0, transition: 'all 0.2s' }} />
                    {isOpen && 'Çıkış'}
                </button>
            </div>
        </aside>
    );
}

