'use client';
import { useState, useEffect } from 'react';
import { WrenchScrewdriverIcon, CheckCircleIcon, ExclamationTriangleIcon, EnvelopeIcon } from '@heroicons/react/24/outline';

export default function AdminSettings() {
    const [maintenanceSettings, setMaintenanceSettings] = useState({});
    const [notificationSettings, setNotificationSettings] = useState({ email: '', enabled: false });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState(null);

    useEffect(() => {
        fetch('/api/admin/settings')
            .then(res => res.json())
            .then(data => {
                setMaintenanceSettings(data.maintenance_mode || {});
                setNotificationSettings(data.admin_notifications || { email: '', enabled: false });
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, []);

    const handleToggleMaintenance = (path) => {
        setMaintenanceSettings(prev => ({
            ...prev,
            [path]: {
                ...prev[path],
                active: !prev[path]?.active
            }
        }));
    };

    const handleMaintenanceMessageChange = (path, msg) => {
        setMaintenanceSettings(prev => ({
            ...prev,
            [path]: {
                ...prev[path],
                message: msg
            }
        }));
    };

    const saveMaintenance = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/admin/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: 'maintenance_mode', value: maintenanceSettings })
            });
            if (res.ok) {
                setToast({ type: 'success', message: 'Bakım modları başarıyla kaydedildi.' });
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

    const saveNotifications = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/admin/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: 'admin_notifications', value: notificationSettings })
            });
            if (res.ok) {
                setToast({ type: 'success', message: 'Bildirim ayarları başarıyla kaydedildi.' });
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
                    <p className="page-subtitle">Site genelindeki bildirim ve bakım ayarlarını yönetin.</p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>
                
                {/* Email Notifications Card */}
                <div className="card">
                    <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
                        <EnvelopeIcon style={{ width: 24 }} />
                        Sipariş Bildirim Ayarları
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                            <div style={{ fontWeight: 600 }}>E-Posta Bildirimlerini Aç</div>
                            <label className="switch">
                                <input 
                                    type="checkbox" 
                                    checked={notificationSettings.enabled} 
                                    onChange={(e) => setNotificationSettings(prev => ({ ...prev, enabled: e.target.checked }))}
                                />
                                <span className="slider round"></span>
                            </label>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Bildirim Gidecek E-Posta</label>
                            <input 
                                className="form-input"
                                type="email"
                                placeholder="admin@example.com"
                                value={notificationSettings.email}
                                onChange={(e) => setNotificationSettings(prev => ({ ...prev, email: e.target.value }))}
                                disabled={!notificationSettings.enabled}
                            />
                            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>Yeni sipariş geldiğinde bu adrese bilgilendirme maili gönderilir.</p>
                        </div>

                        <button 
                            className="btn btn-primary" 
                            style={{ width: '100%', marginTop: '8px' }}
                            onClick={saveNotifications} 
                            disabled={saving}
                        >
                            {saving ? 'Kaydediliyor...' : 'Bildirim Ayarlarını Kaydet'}
                        </button>
                    </div>
                </div>

                {/* Maintenance Mode Card */}
                <div className="card">
                    <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                        <WrenchScrewdriverIcon style={{ width: 24 }} />
                        Sayfa Bazlı Bakım Modu
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: 20 }}>Müşterilerin erişimini engellemek istediğiniz sayfaları seçin.</p>

                    <div className="settings-list">
                        {pages.map(page => (
                            <div key={page.id} className={`settings-item ${maintenanceSettings[page.id]?.active ? 'active' : ''}`}>
                                <div className="item-header">
                                    <div className="item-info">
                                        <div className="item-name">{page.name}</div>
                                        <div className="item-path">{page.id}</div>
                                    </div>
                                    <label className="switch">
                                        <input 
                                            type="checkbox" 
                                            checked={maintenanceSettings[page.id]?.active || false} 
                                            onChange={() => handleToggleMaintenance(page.id)}
                                        />
                                        <span className="slider round"></span>
                                    </label>
                                </div>
                                
                                {maintenanceSettings[page.id]?.active && (
                                    <div className="item-content">
                                        <label className="form-label">Bakım Mesajı</label>
                                        <textarea 
                                            className="form-textarea"
                                            placeholder="Kullanıcılara gösterilecek mesaj..."
                                            value={maintenanceSettings[page.id]?.message || ''}
                                            onChange={(e) => handleMaintenanceMessageChange(page.id, e.target.value)}
                                            style={{ minHeight: '60px' }}
                                        />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <button 
                        className="btn btn-primary" 
                        style={{ width: '100%', marginTop: '24px' }}
                        onClick={saveMaintenance} 
                        disabled={saving}
                    >
                        {saving ? 'Kaydediliyor...' : 'Bakım Ayarlarını Kaydet'}
                    </button>
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
                    gap: 12px;
                    max-height: 500px;
                    overflow-y: auto;
                    padding-right: 8px;
                }
                .settings-item {
                    border: 1px solid var(--border);
                    border-radius: 12px;
                    padding: 12px 16px;
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
                    font-size: 14px;
                    color: var(--text-primary);
                }
                .item-path {
                    font-size: 11px;
                    color: var(--text-muted);
                    font-family: monospace;
                }
                .item-content {
                    margin-top: 12px;
                    padding-top: 12px;
                    border-top: 1px solid var(--border-light);
                }

                /* Switch Style */
                .switch {
                    position: relative;
                    display: inline-block;
                    width: 44px;
                    height: 24px;
                }
                .switch input { opacity: 0; width: 0; height: 0; }
                .slider {
                    position: absolute;
                    cursor: pointer;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background-color: #334155;
                    transition: .4s;
                }
                .slider:before {
                    position: absolute;
                    content: "";
                    height: 16px; width: 16px;
                    left: 4px; bottom: 4px;
                    background-color: white;
                    transition: .4s;
                }
                input:checked + .slider { background-color: var(--primary); }
                .settings-item.active input:checked + .slider { background-color: var(--danger); }
                input:checked + .slider:before { transform: translateX(20px); }
                .slider.round { border-radius: 34px; }
                .slider.round:before { border-radius: 50%; }
            `}</style>
        </div>
    );
}
