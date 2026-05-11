'use client';
import { useState, useEffect } from 'react';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';

export default function PWAInstaller() {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [isInstallable, setIsInstallable] = useState(false);

    useEffect(() => {
        // Extra check for standalone mode
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
        if (isStandalone) {
            setIsInstallable(false);
            return;
        }

        const handler = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
            
            // Show with a slight delay for better UX
            setTimeout(() => {
                // Double check if still not installed before showing
                if (!window.matchMedia('(display-mode: standalone)').matches) {
                    setIsInstallable(true);
                }
            }, 2000);
        };

        window.addEventListener('beforeinstallprompt', handler);

        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;
        
        // Show the prompt
        deferredPrompt.prompt();
        
        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response to the install prompt: ${outcome}`);
        
        // We've used the prompt, and can't use it again, throw it away
        setDeferredPrompt(null);
        setIsInstallable(false);
    };

    if (!isInstallable) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(10px)',
            padding: '12px 24px',
            borderRadius: '100px',
            display: 'flex',
            alignItems: 'center',
            gap: 20,
            color: '#fff',
            boxShadow: '0 10px 40px rgba(0,0,0,0.4)',
            zIndex: 99999,
            border: '1px solid rgba(255,255,255,0.1)',
            animation: 'slideInTop 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
            width: 'max-content',
            maxWidth: '90vw'
        }}>
            <style jsx>{`
                @keyframes slideInTop {
                    from { opacity: 0; transform: translate(-50%, -40px); }
                    to { opacity: 1; transform: translate(-50%, 0); }
                }
            `}</style>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ 
                    background: 'var(--primary)', 
                    padding: 8, 
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <ArrowDownTrayIcon style={{ width: 18, height: 18 }} />
                </div>
                <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: '0.3px' }}>
                    Sistemi Masaüstüne Yükle
                </span>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
                <button 
                    onClick={() => setIsInstallable(false)}
                    style={{ 
                        background: 'transparent', 
                        color: 'rgba(255,255,255,0.6)', 
                        border: 'none', 
                        fontSize: 13,
                        cursor: 'pointer',
                        padding: '4px 8px'
                    }}
                >
                    Geç
                </button>
                <button 
                    onClick={handleInstall}
                    className="btn"
                    style={{ 
                        background: 'var(--primary)', 
                        color: '#fff', 
                        border: 'none', 
                        fontWeight: 700, 
                        padding: '6px 20px',
                        fontSize: 13,
                        borderRadius: '50px',
                        boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
                    }}
                >
                    Yükle
                </button>
            </div>
        </div>
    );
}
