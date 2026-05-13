'use client';
import { usePathname } from 'next/navigation';
import { WrenchScrewdriverIcon } from '@heroicons/react/24/outline';

export default function MaintenanceGate({ children, maintenanceSettings }) {
    const pathname = usePathname();

    // Check if the current route is under maintenance
    const maintenance = maintenanceSettings?.[pathname];

    if (maintenance?.active) {
        return (
            <div className="maintenance-container">
                <div className="maintenance-card">
                    <div className="maintenance-icon-wrapper">
                        <WrenchScrewdriverIcon className="maintenance-icon" />
                    </div>
                    <h1 className="maintenance-title">Bakım Çalışması</h1>
                    <p className="maintenance-message">
                        {maintenance.message || "Bu sayfa şu anda bakım aşamasındadır. Lütfen daha sonra tekrar deneyiniz."}
                    </p>
                    <div className="maintenance-footer">
                        Anlayışınız için teşekkür ederiz.
                    </div>
                </div>

                <style jsx>{`
                    .maintenance-container {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        min-height: calc(100vh - 200px);
                        padding: 20px;
                    }
                    .maintenance-card {
                        background: var(--bg-card);
                        border: 1px solid var(--border);
                        border-radius: 24px;
                        padding: 40px;
                        max-width: 500px;
                        width: 100%;
                        text-align: center;
                        box-shadow: var(--shadow-xl);
                    }
                    .maintenance-icon-wrapper {
                        width: 80px;
                        height: 80px;
                        background: rgba(37, 99, 235, 0.1);
                        border-radius: 20px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin: 0 auto 24px;
                    }
                    .maintenance-icon {
                        width: 48px;
                        height: 48px;
                        color: var(--primary);
                    }
                    .maintenance-title {
                        font-size: 28px;
                        font-weight: 800;
                        color: var(--text-primary);
                        margin-bottom: 16px;
                    }
                    .maintenance-message {
                        font-size: 16px;
                        color: var(--text-secondary);
                        line-height: 1.6;
                        margin-bottom: 24px;
                    }
                    .maintenance-footer {
                        font-size: 14px;
                        color: var(--text-muted);
                        font-weight: 600;
                    }
                `}</style>
            </div>
        );
    }

    return children;
}
