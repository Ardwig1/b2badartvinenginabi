'use client';
import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useTheme } from '@/components/ThemeProvider';
import {
    ChartBarIcon, BuildingOfficeIcon, CubeIcon, CurrencyDollarIcon, ShoppingCartIcon,
    ClipboardDocumentListIcon, DocumentTextIcon, HomeIcon, MagnifyingGlassIcon,
    ChatBubbleLeftEllipsisIcon, CreditCardIcon, FolderOpenIcon, BuildingLibraryIcon,
    EnvelopeIcon, PhoneIcon, SunIcon, MoonIcon, ArrowRightOnRectangleIcon, ChevronDoubleLeftIcon, ChevronDoubleRightIcon,
    Cog6ToothIcon, UserGroupIcon
} from '@heroicons/react/24/outline';
import styles from './Sidebar.module.css';

const adminNav = [
    { label: 'Ana Sayfa', href: '/admin', icon: <ChartBarIcon style={{ width: 20, height: 20 }} /> },
    { label: 'Firmalar', href: '/admin/companies', icon: <BuildingOfficeIcon style={{ width: 20, height: 20 }} /> },
    { label: 'Müşteri Temsilcileri', href: '/admin/representatives', icon: <UserGroupIcon style={{ width: 20, height: 20 }} /> },
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

const repNav = [
    { label: 'Firmalarım', href: '/rep', icon: <BuildingOfficeIcon style={{ width: 20, height: 20 }} /> },
];

export default function Sidebar({ isAdmin = false, isRep = false, companyName = '', userEmail = '', isImpersonated = false }) {
    const { theme, toggleTheme, mounted } = useTheme();
    const pathname = usePathname();
    const router = useRouter();
    const isShowroom = pathname.includes('/admin/showroom') || pathname.includes('/rep/showroom');
    const impersonated = isImpersonated || isShowroom;
    const [isOpen, setIsOpen] = useState(true); // Default to open for better UX, regardless of impersonation
    
    // Determine which menu to show
    // If in showroom mode, ALWAYS show dealer navigation regardless of who the user is
    const navItems = isImpersonated ? dealerNav : (isRep ? repNav : (isAdmin ? adminNav : dealerNav));

    const handleSignOut = async () => {
        try {
            await fetch('/api/log-activity', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action_type: 'logout' })
            });
        } catch (e) {
            console.error('Logout logging failed', e);
        }
        const supabase = createClient();
        await supabase.auth.signOut();
        window.location.href = '/login'; // Full reload to clear CartProvider state
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
                        <div className={styles.logoSub}>{isAdmin ? 'Yönetim Paneli' : 'B2B Bayi Paneli'}</div>
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
                    
                    // If in showroom mode, preserve the showroom=true query param for all internal links
                    const finalHref = isShowroom 
                        ? (item.href.includes('?') ? `${item.href}&showroom=true` : `${item.href}?showroom=true`)
                        : item.href;

                    return (
                        <Link
                            key={item.href}
                            href={finalHref}
                            className={`${styles.navItem} ${isActive ? styles.active : ''}`}
                        >
                            <span className={styles.navIcon}>{item.icon}</span>
                            {isOpen && <span>{item.label}</span>}
                        </Link>
                    );
                })}

                {/* Mobile logout button */}
                <button onClick={handleSignOut} className={`${styles.navItem} mobile-only-logout`} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                    <span className={styles.navIcon}><ArrowRightOnRectangleIcon style={{ width: 22, height: 22, color: 'var(--danger)' }} /></span>
                    <span style={{ color: 'var(--danger)', fontSize: '10px', fontWeight: 800 }}>ÇIKIŞ</span>
                </button>
            </nav>

            <style jsx>{`
                .mobile-only-logout { display: none !important; }
                @media (max-width: 768px) {
                    .mobile-only-logout { display: flex !important; }
                }
            `}</style>

            {/* Theme & User Info */}
            <div className={styles.userSection}>
                {mounted && (
                    <button className={styles.themeToggle} onClick={toggleTheme} title="Görünümü Değiştir">
                        {theme === 'dark' ? <><SunIcon style={{ width: 16, height: 16, marginRight: 6 }} /> Aydınlık Mod</> : <><MoonIcon style={{ width: 16, height: 16, marginRight: 6 }} /> Karanlık Mod</>}
                    </button>
                )}
                <div className={styles.userInfo}>
                    <div className={styles.userAvatar}>
                        {(companyName || userEmail || 'B')[0].toUpperCase()}
                    </div>
                    {isOpen && (
                        <div className={styles.userDetails}>
                            <div className={styles.userName}>{companyName || (isAdmin ? 'Yönetici' : (isRep ? 'Temsilci' : 'Bayi Paneli'))}</div>
                            <div className={styles.userEmail}>{userEmail}</div>
                        </div>
                    )}
                </div>
                {/* Admin always sees their logout. Dealer only sees it if NOT impersonated. Representative always sees it. */}
                {(isAdmin || isRep || !impersonated) && (
                    <button className={styles.signOutBtn} onClick={handleSignOut} id="sidebar-signout" title="Çıkış Yap">
                        <ArrowRightOnRectangleIcon style={{ width: 20, height: 20, marginRight: isOpen ? 6 : 0, transition: 'all 0.2s' }} />
                        {isOpen && 'Çıkış'}
                    </button>
                )}
            </div>
        </aside>
    );
}

