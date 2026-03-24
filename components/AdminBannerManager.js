'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { PhotoIcon, TrashIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';

export default function AdminBannerManager() {
    const [banners, setBanners] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [hiddenDefaults, setHiddenDefaults] = useState([]);
    const supabase = createClient();

    const fetchBanners = async () => {
        setLoading(true);
        // 1. Fetch custom banners
        const { data, error } = await supabase
            .from('banners')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (!error) setBanners(data || []);

        // 2. Fetch hidden defaults from price_groups (our settings hack)
        const { data: hiddenData } = await supabase
            .from('price_groups')
            .select('name')
            .eq('discount_percent', -999); // Use -999 as a special marker for hidden default banners
            
        if (hiddenData) {
            setHiddenDefaults(hiddenData.map(d => d.name));
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchBanners();
    }, []);

    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('/api/admin/upload-file', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();

            if (data.success) {
                const { error } = await supabase
                    .from('banners')
                    .insert([{ image_url: data.url, is_active: true }]);
                
                if (error) throw error;
                fetchBanners();
            } else {
                alert('Yükleme hatası: ' + data.error);
            }
        } catch (err) {
            alert('Hata: ' + err.message);
        } finally {
            setUploading(false);
        }
    };

    const deleteBanner = async (id, url, isStatic = false) => {
        if (!confirm(isStatic ? 'Bu varsayılan bannerı gizlemek istediğinize emin misiniz?' : 'Bu bannerı kaldırmak istediğinize emin misiniz?')) return;

        try {
            if (isStatic) {
                // Gizleme işlemini price_groups tablosuna kaydet (Marker: -999)
                const { error } = await supabase.from('price_groups').insert({
                    name: `HIDDEN_BANNER_${id}`,
                    discount_percent: -999
                });
                if (error) throw error;
            } else {
                // 1. Storage'dan sil
                await fetch('/api/admin/delete-file', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url })
                });

                // 2. DB'den sil
                const { error } = await supabase.from('banners').delete().eq('id', id);
                if (error) throw error;
            }

            fetchBanners();
        } catch (err) {
            alert('Silme/Gizleme hatası: ' + err.message);
        }
    };

    return (
        <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <PhotoIcon style={{ width: 22, height: 22, color: 'var(--primary)' }} />
                    Banner Yönetimi
                </h2>
                <button 
                    className="btn btn-primary btn-sm" 
                    onClick={() => setShowModal(true)}
                    style={{ borderRadius: 20, padding: '6px 16px' }}
                >
                    <PlusIcon style={{ width: 16, height: 16, marginRight: 4 }} />
                    Banner Yönet
                </button>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" style={{ maxWidth: 600, width: '95%' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Bannerları Yönet</h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}><XMarkIcon style={{ width: 20, height: 20 }} /></button>
                        </div>
                        
                        <div style={{ padding: 20 }}>
                            {/* Upload Area */}
                            <div style={{ 
                                border: '2px dashed var(--border)', 
                                borderRadius: 12, 
                                padding: 24, 
                                textAlign: 'center',
                                background: 'var(--bg-secondary)',
                                marginBottom: 24,
                                position: 'relative'
                            }}>
                                <input 
                                    type="file" 
                                    accept="image/*" 
                                    onChange={handleFileUpload} 
                                    style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                                    disabled={uploading}
                                />
                                <div style={{ color: uploading ? 'var(--primary)' : 'var(--text-secondary)' }}>
                                    {uploading ? (
                                        <div className="loading-spinner" style={{ margin: '0 auto 12px' }} />
                                    ) : (
                                        <PlusIcon style={{ width: 32, height: 32, margin: '0 auto 12px', opacity: 0.5 }} />
                                    )}
                                    <div style={{ fontWeight: 600 }}>{uploading ? 'Yükleniyor...' : 'Yeni Banner Ekle'}</div>
                                    <div style={{ fontSize: 12, marginTop: 4 }}>Resim dosyasını sürükleyin veya tıklayın</div>
                                </div>
                            </div>

                            {/* Banner List */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 400, overflowY: 'auto', paddingRight: 4 }}>
                                {loading ? (
                                    <div className="loading-center" style={{ padding: 20 }}><div className="loading-spinner" /></div>
                                ) : (banners.length > 0 ? banners : [
                                    { id: 'def1', image_url: '/banner1.jpg', is_static: true },
                                    { id: 'def2', image_url: '/banner2.jpg', is_static: true },
                                    { id: 'def3', image_url: '/banner3.jpg', is_static: true }
                                ].filter(b => !hiddenDefaults.includes(`HIDDEN_BANNER_${b.id}`))).map(b => (
                                    <div key={b.id} style={{ 
                                        display: 'flex', 
                                        gap: 12, 
                                        alignItems: 'center', 
                                        padding: 12, 
                                        background: 'var(--bg-surface)', 
                                        border: '1px solid var(--border)',
                                        borderRadius: 8,
                                        opacity: b.is_static ? 0.7 : 1
                                    }}>
                                        <div style={{ width: 120, height: 40, position: 'relative', borderRadius: 4, overflow: 'hidden' }}>
                                            <img src={b.image_url} alt="Banner" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        </div>
                                        <div style={{ flex: 1, fontSize: 13, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {b.image_url.split('/').pop()}
                                        </div>
                                        <button 
                                            className="btn btn-ghost btn-sm" 
                                            onClick={() => deleteBanner(b.id, b.image_url, b.is_static)}
                                            style={{ color: 'var(--danger)', padding: 6 }}
                                        >
                                            <TrashIcon style={{ width: 18, height: 18 }} />
                                        </button>
                                    </div>
                                ))}
                                {banners.length === 0 && !loading && (
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginTop: 8, background: '#fef3c7', padding: 8, borderRadius: 6, border: '1px solid #fde68a' }}>
                                        ⚠️ Henüz özel banner eklemediniz. Sistem varsayılan bannerlar gösteriliyor. Bir adet eklediğinizde bunlar gizlenecektir.
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="modal-footer" style={{ borderTop: '1px solid var(--border)', padding: '16px 20px', display: 'flex', justifyContent: 'flex-end' }}>
                            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Kapat</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
