'use client';
import { useState, useEffect } from 'react';
import { WrenchScrewdriverIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

export default function AdminSettings() {
    const [settings, setSettings] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState(null);

    useEffect(() => {
        fetch('/api/admin/settings')
            .then(res => res.json())
            .then(data => {
                setSettings(data);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, []);

    const handleToggle = (path) => {
        setSettings(prev => ({
            ...prev,
            [path]: {
                ...prev[path],
                active: !prev[path]?.active
            }
        }));
    };

    const handleMessageChange = (path, msg) => {
        setSettings(prev => ({
            ...prev,
            [path]: {
                ...prev[path],
                message: msg
            }
        }));
    };

    const saveSettings = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/admin/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });
            if (res.ok) {
                setToast({ type: 'success', message: 'Ayarlar başarıyla kaydedildi.' });
                setTimeout(() => setToast(null), 3000);
            } else {
                throw new Error('Kaydedilemedi');
            }
        } catch (err) {
            setToast({ type: 'error', message: 'Bir hata oluştu.' });
            setTimeout(() => setToast(null), 3000);
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="page-wrapper loading-center"><div className="loading-spinner" /></div>;

    const pages = [
        { id: '/dashboard', name: 'Ana Sayfa' },
        { id: '/dashboard/catalog', name: 'Ürün Arama' },
        { id: '/dashboard/cart', name: 'Sepetim' },
        { id: '/dashboard/orders', name: 'Siparişlerim' },
        { id: '/dashboard/account', name: 'Cari Hesap' },
        { id: '/dashboard/invoices', name: 'Faturalarım' },
        { id: '/dashboard/payment', name: 'Online Ödeme' },
        { id: '/dashboard/bank-accounts', name: 'Banka Bilgileri' },
        { id: '/dashboard/suggestions', name: 'Öneri ve Şikayet' },
        { id: '/dashboard/contact', name: 'İletişim' }
    ];

    return (
        <div className="page-wrapper">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Sistem Ayarları</h1>
                    <p className="page-subtitle">Site genelindeki sayfa bazlı bakım modunu yönetin.</p>
                </div>
                <button 
                    className="btn btn-primary" 
                    onClick={saveSettings} 
                    disabled={saving}
                >
                    {saving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
                </button>
            </div>

            <div className="card">
                <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
                    <WrenchScrewdriverIcon style={{ width: 24 }} />
                    Sayfa Bazlı Bakım Modu
                </div>

                <div className="settings-list">
                    {pages.map(page => (
                        <div key={page.id} className={`settings-item ${settings[page.id]?.active ? 'active' : ''}`}>
                            <div className="item-header">
                                <div className="item-info">
                                    <div className="item-name">{page.name}</div>
                                    <div className="item-path">{page.id}</div>
                                </div>
                                <label className="switch">
                                    <input 
                                        type="checkbox" 
                                        checked={settings[page.id]?.active || false} 
                                        onChange={() => handleToggle(page.id)}
                                    />
                                    <span className="slider round"></span>
                                </label>
                            </div>
                            
                            {settings[page.id]?.active && (
                                <div className="item-content">
                                    <label className="form-label">Bakım Mesajı</label>
                                    <textarea 
                                        className="form-textarea"
                                        placeholder="Kullanıcılara gösterilecek mesaj..."
                                        value={settings[page.id]?.message || ''}
                                        onChange={(e) => handleMessageChange(page.id, e.target.value)}
                                    />
                                    <div className="warning-note">
                                        <ExclamationTriangleIcon style={{ width: 16 }} />
                                        Bu sayfa şu anda müşterilere kapalıdır.
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {toast && (
                <div className={`toast toast-${toast.type}`}>
                    {toast.type === 'success' ? <CheckCircleIcon style={{ width: 20 }} /> : <ExclamationTriangleIcon style={{ width: 20 }} />}
                    {toast.message}
                </div>
            )}

            <style jsx>{`
                .settings-list {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }
                .settings-item {
                    border: 1px solid var(--border);
                    border-radius: 16px;
                    padding: 20px;
                    transition: all 0.2s;
                }
                .settings-item.active {
                    border-color: var(--danger);
                    background: rgba(239, 68, 68, 0.02);
                }
                .item-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .item-name {
                    font-weight: 700;
                    font-size: 16px;
                    color: var(--text-primary);
                }
                .item-path {
                    font-size: 13px;
                    color: var(--text-muted);
                    font-family: monospace;
                }
                .item-content {
                    margin-top: 20px;
                    padding-top: 20px;
                    border-top: 1px solid var(--border-light);
                }
                .warning-note {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-top: 12px;
                    color: var(--danger);
                    font-size: 13px;
                    font-weight: 600;
                }

                /* Switch Style */
                .switch {
                    position: relative;
                    display: inline-block;
                    width: 50px;
                    height: 26px;
                }
                .switch input { opacity: 0; width: 0; height: 0; }
                .slider {
                    position: absolute;
                    cursor: pointer;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background-color: #ccc;
                    transition: .4s;
                }
                .slider:before {
                    position: absolute;
                    content: "";
                    height: 18px; width: 18px;
                    left: 4px; bottom: 4px;
                    background-color: white;
                    transition: .4s;
                }
                input:checked + .slider { background-color: var(--danger); }
                input:checked + .slider:before { transform: translateX(24px); }
                .slider.round { border-radius: 34px; }
                .slider.round:before { border-radius: 50%; }
            `}</style>
        </div>
    );
}
