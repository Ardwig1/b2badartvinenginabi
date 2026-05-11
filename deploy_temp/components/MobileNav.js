'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
    HomeIcon, MagnifyingGlassIcon, CreditCardIcon, 
    UserCircleIcon, Squares2X2Icon, BuildingLibraryIcon, 
    PhoneIcon, ChatBubbleLeftEllipsisIcon, ShoppingCartIcon,
    ClipboardDocumentListIcon, CurrencyDollarIcon, DocumentTextIcon,
    XMarkIcon, ArrowRightOnRectangleIcon
} from '@heroicons/react/24/outline';
import { useCart } from '@/components/CartProvider';
import { createClient } from '@/lib/supabase/client';

// Mobile navigation component with iOS safe area support
export default function MobileNav() {
    const pathname = usePathname();
    const router = useRouter();
    const { cartItems } = useCart();
    const [activeSubmenu, setActiveSubmenu] = useState(null);
    
    const totalCartItems = Object.values(cartItems || {}).reduce((a, b) => a + (b.qty || 0), 0);

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

    if (pathname.startsWith('/admin') || pathname.startsWith('/rep') || pathname === '/login' || pathname === '/register') return null;

    const navItems = [
        { label: 'ANA SAYFA', href: '/dashboard', icon: <HomeIcon style={{ width: 22, height: 22 }} /> },
        { label: 'ARAMA', href: '/dashboard/catalog', icon: <MagnifyingGlassIcon style={{ width: 22, height: 22 }} /> },
        { label: 'HESABIM', type: 'submenu', id: 'account', icon: <UserCircleIcon style={{ width: 22, height: 22 }} /> },
        { label: 'ÖDEME', href: '/dashboard/payment', icon: <CreditCardIcon style={{ width: 22, height: 22 }} /> },
        { label: 'MENÜ', type: 'submenu', id: 'menu', icon: <Squares2X2Icon style={{ width: 22, height: 22 }} /> },
    ];

    const menuItems = [
        { label: 'Bankalar', href: '/dashboard/bank-accounts', icon: <BuildingLibraryIcon style={{ width: 18, height: 18 }} /> },
        { label: 'İletişim', href: '/dashboard/contact', icon: <PhoneIcon style={{ width: 18, height: 18 }} /> },
        { label: 'Öneri', href: '/dashboard/suggestions', icon: <ChatBubbleLeftEllipsisIcon style={{ width: 18, height: 18 }} /> },
    ];

    const accountItems = [
        { label: 'Sepetim', href: '/dashboard/cart', icon: <ShoppingCartIcon style={{ width: 18, height: 18 }} />, badge: totalCartItems },
        { label: 'Siparişler', href: '/dashboard/orders', icon: <ClipboardDocumentListIcon style={{ width: 18, height: 18 }} /> },
        { label: 'Cari Hesap', href: '/dashboard/account', icon: <CurrencyDollarIcon style={{ width: 18, height: 18 }} /> },
        { label: 'Faturalar', href: '/dashboard/invoices', icon: <DocumentTextIcon style={{ width: 18, height: 18 }} /> },
    ];

    return (
        <>
            {/* MINIMALIST OVERLAY */}
            {activeSubmenu && (
                <div className="overlay" onClick={() => setActiveSubmenu(null)}>
                    <div className="sheet" onClick={e => e.stopPropagation()}>
                        <div className="sheet-header">
                            <span>{activeSubmenu === 'menu' ? 'DESTEK' : 'HESABIM'}</span>
                            <button className="close-btn" onClick={() => setActiveSubmenu(null)}><XMarkIcon style={{ width: 20, height: 20 }} /></button>
                        </div>
                        <div className="sheet-grid">
                            {(activeSubmenu === 'menu' ? menuItems : accountItems).map((item) => (
                                <Link key={item.href} href={item.href} className="sheet-item" onClick={() => setActiveSubmenu(null)}>
                                    <div className="sheet-icon-box">
                                        {item.icon}
                                        {item.badge > 0 && <span className="badge">{item.badge}</span>}
                                    </div>
                                    <span>{item.label}</span>
                                </Link>
                            ))}
                            {activeSubmenu === 'menu' && (
                                <button className="sheet-item" onClick={handleSignOut} style={{ cursor: 'pointer', border: '1px solid rgba(220, 38, 38, 0.2)', background: 'rgba(220, 38, 38, 0.05)' }}>
                                    <div className="sheet-icon-box" style={{ color: 'var(--danger)' }}>
                                        <ArrowRightOnRectangleIcon style={{ width: 18, height: 18 }} />
                                    </div>
                                    <span style={{ color: 'var(--danger)' }}>Güvenli Çıkış</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* BOTTOM NAV BAR */}
            <div className="bar-wrapper">
                <nav className="bar">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href || activeSubmenu === item.id;
                        const content = (
                            <div className={`btn-box ${isActive ? 'active' : ''}`}>
                                <div className="icon-container">{item.icon}</div>
                                <span className="btn-label">{item.label}</span>
                            </div>
                        );

                        if (item.type === 'submenu') {
                            return (
                                <button key={item.id} onClick={() => setActiveSubmenu(activeSubmenu === item.id ? null : item.id)} className="raw-btn">
                                    {content}
                                </button>
                            );
                        }
                        return (
                            <Link key={item.href} href={item.href} className="raw-btn">
                                {content}
                            </Link>
                        );
                    })}
                </nav>
            </div>

            <style jsx>{`
                .bar-wrapper { 
                    position: fixed; 
                    bottom: 0; 
                    left: 0; 
                    right: 0; 
                    background: var(--bg-card); 
                    border-top: 1px solid var(--border); 
                    z-index: 10000; 
                    padding-bottom: env(safe-area-inset-bottom); 
                    box-shadow: 0 -4px 15px rgba(0,0,0,0.1); 
                }
                
                @media (min-width: 769px) { .bar-wrapper { display: none; } }
                
                .bar { 
                    display: grid; 
                    grid-template-columns: repeat(5, 1fr); 
                    height: 64px; 
                    width: 100%; 
                    align-items: center; 
                    justify-items: center;
                }

                .raw-btn { 
                    display: flex; 
                    align-items: center; 
                    justify-content: center; 
                    width: 100%; 
                    height: 100%; 
                    text-decoration: none; 
                    background: none; 
                    border: none; 
                    padding: 0; 
                    margin: 0;
                    cursor: pointer; 
                    outline: none;
                    line-height: 1; /* Satır yüksekliğini sabitle */
                }

                .btn-box { 
                    display: flex; 
                    flex-direction: column; 
                    align-items: center; 
                    justify-content: center; 
                    gap: 4px; 
                    color: var(--text-secondary); 
                    width: 100%;
                    height: 100%;
                }

                .btn-box.active { color: var(--primary); }
                .btn-label { font-size: 9px; font-weight: 800; text-align: center; display: block; margin: 0; padding: 0; line-height: 1; }
                .icon-container { display: flex; align-items: center; justify-content: center; height: 24px; margin: 0; padding: 0; }

                .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); backdrop-filter: blur(2px); z-index: 9999; display: flex; align-items: flex-end; }
                .sheet { width: 100%; background: var(--bg-card); border-radius: 20px 20px 0 0; padding: 20px; padding-bottom: calc(84px + env(safe-area-inset-bottom)); animation: slideUp 0.2s ease-out; }
                .sheet-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; font-weight: 800; font-size: 13px; color: var(--text-secondary); letter-spacing: 1px; }
                .close-btn { background: none; border: none; color: var(--text-secondary); padding: 0; cursor: pointer; }
                .sheet-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
                .sheet-item { display: flex; align-items: center; gap: 10px; padding: 12px; background: var(--bg-surface); border: 1px solid var(--border); border-radius: 12px; color: var(--text-primary); text-decoration: none; font-size: 13px; font-weight: 600; }
                .sheet-icon-box { position: relative; color: var(--primary); display: flex; align-items: center; }
                .badge { position: absolute; top: -8px; right: -10px; background: var(--danger); color: white; font-size: 9px; font-weight: 800; padding: 2px 5px; border-radius: 10px; border: 2px solid var(--bg-card); }

                @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
            `}</style>
        </>
    );
}
