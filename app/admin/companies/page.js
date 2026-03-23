'use client';
import { useState, useEffect, useCallback } from 'react';
import { BuildingOfficeIcon, MagnifyingGlassIcon, TrashIcon, KeyIcon, ClockIcon, LockClosedIcon, LockOpenIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';

const statusMap = { pending: 'Bekliyor', approved: 'Aktif', rejected: 'Uzaklaştırıldı', history: 'Geçmiş' };
const statusBadge = { pending: 'badge-pending', approved: 'badge-approved', rejected: 'badge-rejected', history: 'badge-history' };
const EMPTY_FORM = {
    companyName: '', taxNumber: '', taxOffice: '', contactPerson: '',
    phone: '', address: '', city: '', district: '', branch: '',
    dealerCode: '', userCode: 'ADMIN', email: '', password: '', confirmPassword: ''
};

export default function AdminCompanies() {
    const [companies, setCompanies] = useState([]);
    const [priceGroups, setPriceGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [search, setSearch] = useState('');

    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState(EMPTY_FORM);
    const [formLoading, setFormLoading] = useState(false);
    const [formError, setFormError] = useState('');
    const [formSuccess, setFormSuccess] = useState('');

    const [activities, setActivities] = useState([]);
    
    // Edit Modal States
    const [editModal, setEditModal] = useState({ show: false, company: null });
    const [editFormData, setEditFormData] = useState({ password: '', confirmPassword: '', userCode: '', dealerCode: '' });
    const [editLoading, setEditLoading] = useState(false);
    const [editMessage, setEditMessage] = useState({ type: '', text: '' });

    // Delete Modal States
    const [deleteModal, setDeleteModal] = useState({ show: false, company: null, step: 1 });

    // Risk Limit Modal States
    const [riskModal, setRiskModal] = useState({ show: false, company: null, value: '' });
    const [riskLoading, setRiskLoading] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/create-company?filter=${filter}`);
            const result = await res.json();
            setCompanies(result.companies || []);
            setPriceGroups(result.priceGroups || []);
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    }, [filter]);

    const fetchActivities = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/activities');
            const data = await res.json();
            setActivities(data.activities || []);
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        if (filter === 'history') { fetchActivities(); }
        else { fetchData(); }
    }, [filter, fetchData, fetchActivities]);

    const updateStatus = async (id, status) => {
        await fetch('/api/admin/create-company', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, status })
        });
        fetchData();
    };

    const togglePrepaymentLock = async (id, currentValue) => {
        try {
            const res = await fetch('/api/admin/create-company', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, is_prepayment_locked: !currentValue })
            });
            const data = await res.json();
            if (!res.ok) {
                alert(`Kilit değiştirilemedi!\nLütfen Supabase SQL Editor'e gidip '006_prepayment_lock.sql' dosyasını çalıştırdığınıza emin olun.\nSistem Hatası: ${data.error}`);
            }
        } catch (e) {
            alert('İletişim Hatası: ' + e.message);
        }
        fetchData(); // refresh UI
    };

    const updatePriceGroup = async (id, price_group_id) => {
        await fetch('/api/admin/create-company', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, price_group_id })
        });
        fetchData();
    };

    const update = (field) => (e) => {
        const value = e.target.value;
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleAddCompany = async (e) => {
        e.preventDefault();
        setFormError('');
        setFormSuccess('');

        const pw = formData.password.trim();
        const cpw = formData.confirmPassword.trim();

        if (pw !== cpw) {
            setFormError('Şifreler eşleşmiyor.');
            return;
        }
        if (pw.length < 6) {
            setFormError('Şifre en az 6 karakter olmalı.');
            return;
        }

        setFormLoading(true);
        try {
            const res = await fetch('/api/admin/create-company', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const result = await res.json();
            if (!res.ok) {
                setFormError(result.error || 'Bir hata oluştu.');
            } else {
                setFormSuccess(`"${formData.companyName}" başarıyla eklendi!`);
                setFormData(EMPTY_FORM);
                fetchData();
                setTimeout(() => { setShowModal(false); setFormSuccess(''); }, 2000);
            }
        } catch (err) {
            setFormError('Sunucu hatası: ' + err.message);
        }
        setFormLoading(false);
    };

    const confirmDelete = async () => {
        if (!deleteModal.company?.id) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/create-company?id=${deleteModal.company.id}`, { method: 'DELETE' });
            if (res.ok) {
                fetchData();
                setDeleteModal({ show: false, company: null, step: 1 });
            } else {
                alert('Silme işlemi başarısız oldu.');
            }
        } catch (e) {
            alert('Hata: ' + e.message);
        }
        setLoading(false);
    };

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        setEditMessage({ type: '', text: '' });

        if (editFormData.password && editFormData.password !== editFormData.confirmPassword) {
            return setEditMessage({ type: 'error', text: 'Şifreler eşleşmiyor!' });
        }
        if (editFormData.password && editFormData.password.length < 6) {
            return setEditMessage({ type: 'error', text: 'Şifre en az 6 karakter olmalı!' });
        }

        setEditLoading(true);
        try {
            const res = await fetch('/api/admin/create-company', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    id: editModal.company.id, 
                    password: editFormData.password || undefined,
                    user_code: editFormData.userCode || undefined,
                    dealer_code: editFormData.dealerCode || undefined
                })
            });
            if (res.ok) {
                setEditMessage({ type: 'success', text: 'Bilgiler başarıyla güncellendi!' });
                fetchData();
                setTimeout(() => setEditModal({ show: false, company: null }), 1500);
            } else {
                const data = await res.json();
                setEditMessage({ type: 'error', text: data.error || 'Güncelleme başarısız!' });
            }
        } catch (e) {
            setEditMessage({ type: 'error', text: e.message });
        }
        setEditLoading(false);
    };

    const filtered = companies.filter(c =>
        c.name?.toLowerCase().includes(search.toLowerCase()) ||
        c.tax_number?.includes(search) ||
        c.email?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="page-wrapper">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Firma Yönetimi</h1>
                    <p className="page-subtitle">Kayıtlı firmalar ve onay işlemleri</p>
                </div>
                <button className="btn btn-primary" onClick={() => { setShowModal(true); setFormError(''); setFormSuccess(''); setFormData(EMPTY_FORM); }} id="add-company-btn">
                    + Firma Ekle
                </button>
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                <div className="tabs" style={{ marginBottom: 0 }}>
                    {['all', 'pending', 'approved', 'rejected', 'history'].map(f => (
                        <button key={f} className={`tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
                            {f === 'all' ? 'Tümü' : statusMap[f]}
                        </button>
                    ))}
                </div>
                {filter !== 'history' && (
                    <div className="search-bar">
                        <span className="search-icon"><MagnifyingGlassIcon style={{ width: 14, height: 14 }} /></span>
                        <input placeholder="Firma adı, vergi no, e-posta..." value={search} onChange={e => setSearch(e.target.value)} id="companies-search" />
                    </div>
                )}
            </div>

            {loading ? (
                <div className="loading-center"><div className="loading-spinner" /></div>
            ) : filter === 'history' ? (
                <div className="card" style={{ padding: 0 }}>
                    {activities.length === 0 ? (
                        <div className="empty-state" style={{ padding: 40 }}><div className="empty-state-icon"><ClockIcon style={{ width: 32, height: 32 }} /></div>Geçmiş işlem bulunmuyor.</div>
                    ) : (
                        <div className="table-wrapper">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Firma</th>
                                        <th>Tarih</th>
                                        <th>İşlem Tipi</th>
                                        <th>Detay</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {activities.map(act => (
                                        <tr key={act.id}>
                                            <td style={{ fontWeight: 600 }}>{act.companies?.name || 'Bilinmiyor'}</td>
                                            <td style={{ color: 'var(--text-secondary)' }}>{new Date(act.created_at).toLocaleString('tr-TR')}</td>
                                            <td>
                                                <span className="badge" style={{ background: 'var(--bg-canvas)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
                                                    {act.action_type === 'login' && 'Giriş Yaptı'}
                                                    {act.action_type === 'search' && 'Ürün Aradı'}
                                                    {act.action_type === 'cart_add' && 'Sepete Ekledi'}
                                                    {act.action_type === 'order_placed' && 'Sipariş Verdi'}
                                                    {act.action_type === 'invoice_view' && 'Hesap Görüntüledi'}
                                                    {!['login','search','cart_add','order_placed','invoice_view'].includes(act.action_type) && act.action_type}
                                                </span>
                                            </td>
                                            <td style={{ color: 'var(--text-secondary)' }}>
                                                {act.action_type === 'search' && act.details?.text ? `Aranan: "${act.details?.text}"` : JSON.stringify(act.details || {})}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            ) : filtered.length === 0 ? (
                <div className="card"><div className="empty-state"><div className="empty-state-icon"><BuildingOfficeIcon style={{ width: 32, height: 32 }} /></div><div className="empty-state-title">Firma bulunamadı</div></div></div>
            ) : (
                <div className="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Firma Adı</th>
                                <th>Vergi No</th>
                                <th>Yetkili</th>
                                <th>E-posta</th>
                                <th>Fiyat Grubu</th>
                                <th>Durum</th>
                                <th>İşlemler</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(c => (
                                <tr key={c.id}>
                                    <td style={{ fontWeight: 600 }}>
                                        <Link href={`/admin/companies/${c.id}`} className="btn btn-ghost btn-sm" style={{ 
                                            color: 'var(--brand)', 
                                            textDecoration: 'none', 
                                            background: 'rgba(56, 189, 248, 0.1)',
                                            border: '1px solid rgba(56, 189, 248, 0.2)',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: 8,
                                            padding: '4px 12px'
                                        }}>
                                            {c.name}
                                            <span style={{ fontSize: 16 }}>→</span>
                                        </Link>
                                    </td>
                                    <td style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{c.tax_number}</td>
                                    <td>{c.contact_person || '-'}</td>
                                    <td style={{ color: 'var(--text-secondary)' }}>{c.email}</td>
                                    <td>
                                        <select
                                            className="form-select"
                                            style={{ padding: '5px 28px 5px 8px', fontSize: 13, width: 'auto' }}
                                            value={c.price_group_id || ''}
                                            onChange={e => updatePriceGroup(c.id, e.target.value)}
                                            id={`pg-select-${c.id}`}
                                        >
                                            <option value="">-</option>
                                            {priceGroups.map(pg => (
                                                <option key={pg.id} value={pg.id}>{pg.name}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td><span className={`badge ${statusBadge[c.status]}`}>{statusMap[c.status]}</span></td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            {c.status !== 'approved' && (
                                                <button className="btn btn-success btn-sm" onClick={() => updateStatus(c.id, 'approved')} id={`approve-${c.id}`}>✓ Onayla</button>
                                            )}
                                            {c.status !== 'rejected' && (
                                                <button className="btn btn-danger btn-sm" onClick={() => updateStatus(c.id, 'rejected')} id={`reject-${c.id}`}>✗ Uzaklaştır</button>
                                            )}
                                            <button 
                                                className="btn btn-sm" 
                                                style={{ 
                                                    backgroundColor: c.is_prepayment_locked ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                                                    borderColor: c.is_prepayment_locked ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)',
                                                    color: c.is_prepayment_locked ? '#dc2626' : '#16a34a',
                                                    padding: '4px 8px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}
                                                onClick={() => togglePrepaymentLock(c.id, c.is_prepayment_locked)} 
                                                title={c.is_prepayment_locked ? "Ön Ödeme Zorunlu (Açmak için tıkla)" : "Ön Ödeme Kapalı (Kilitlemek için tıkla)"}
                                            >
                                                {c.is_prepayment_locked ? <LockClosedIcon style={{ width: 16, height: 16 }} /> : <LockOpenIcon style={{ width: 16, height: 16 }} />}
                                            </button>
                                            <button 
                                                className="btn btn-sm" 
                                                style={{ 
                                                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                                                    borderColor: 'rgba(245, 158, 11, 0.3)',
                                                    color: '#d97706',
                                                    padding: '4px 8px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}
                                                onClick={() => setRiskModal({ show: true, company: c, value: c.risk_limit || '0' })} 
                                                title={`Risk Limitini Düzenle (Şu an: ₺${Number(c.risk_limit || 0).toLocaleString('tr-TR')})`}
                                            >
                                                <ExclamationCircleIcon style={{ width: 16, height: 16 }} />
                                            </button>
                                            <button className="btn btn-ghost btn-sm" onClick={() => { setEditFormData({ password: '', confirmPassword: '', userCode: c.user_code || '', dealerCode: c.dealer_code || '' }); setEditMessage({ type: '', text: '' }); setEditModal({ show: true, company: c }); }} title="Firma ve Kullanıcı Şifresini Düzenle"><KeyIcon style={{ width: 16, height: 16 }} /></button>
                                            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => setDeleteModal({ show: true, company: c, step: 1 })} title="Firmayı ve Tüm Verilerini Sil"><TrashIcon style={{ width: 16, height: 16 }} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Firma Ekle Modal */}
            {showModal && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1000, padding: 16
                }}>
                    <div style={{
                        background: 'var(--bg-card)', borderRadius: 12, padding: 32,
                        width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                            <h2 style={{ fontSize: 20, fontWeight: 600 }}>Yeni Firma Ekle</h2>
                            <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: 'var(--text-secondary)' }}>×</button>
                        </div>

                        {formError && <div style={{ marginBottom: 16, padding: '10px 14px', background: '#fee2e2', color: '#dc2626', borderRadius: 8, fontSize: 14 }}>{formError}</div>}
                        {formSuccess && <div style={{ marginBottom: 16, padding: '10px 14px', background: '#d1fae5', color: '#059669', borderRadius: 8, fontSize: 14 }}>✅ {formSuccess}</div>}

                        <form onSubmit={handleAddCompany} autoComplete="off">
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label className="form-label">Firma Adı *</label>
                                    <input className="form-input" type="text" placeholder="ABC Otomotiv Ltd. Şti." value={formData.companyName} onChange={update('companyName')} required id="modal-company-name" autoComplete="off" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Vergi Numarası *</label>
                                    <input className="form-input" type="text" placeholder="1234567890" value={formData.taxNumber} onChange={update('taxNumber')} required id="modal-tax-number" autoComplete="off" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Vergi Dairesi</label>
                                    <input className="form-input" type="text" placeholder="Örn: Beyoğlu VD" value={formData.taxOffice} onChange={update('taxOffice')} id="modal-tax-office" autoComplete="off" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Yetkili Kişi *</label>
                                    <input className="form-input" type="text" placeholder="Ad Soyad" value={formData.contactPerson} onChange={update('contactPerson')} required id="modal-contact" autoComplete="off" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">E-posta (Arka Plan İçin) *</label>
                                    <input className="form-input" type="email" placeholder="firma@email.com" value={formData.email} onChange={update('email')} required id="modal-email" autoComplete="off" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Telefon</label>
                                    <input className="form-input" type="tel" placeholder="0532 000 00 00" value={formData.phone} onChange={update('phone')} id="modal-phone" autoComplete="off" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">İl</label>
                                    <input className="form-input" type="text" placeholder="Örn: İstanbul" value={formData.city} onChange={update('city')} id="modal-city" autoComplete="off" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">İlçe</label>
                                    <input className="form-input" type="text" placeholder="Örn: Kadıköy" value={formData.district} onChange={update('district')} id="modal-district" autoComplete="off" />
                                </div>
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label className="form-label">Adres</label>
                                    <input className="form-input" type="text" placeholder="Firma adresi" value={formData.address} onChange={update('address')} id="modal-address" autoComplete="off" />
                                </div>
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label className="form-label">Branş / Tip</label>
                                    <input className="form-input" type="text" placeholder="Toptancı, Perakendeci, Servis vb." value={formData.branch} onChange={update('branch')} id="modal-branch" autoComplete="off" />
                                </div>

                                {/* Giriş Bilgileri */}
                                <div style={{ gridColumn: '1 / -1', marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                                    <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Sisteme Giriş Bilgileri (Login)</h3>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Bayi Kodu *</label>
                                    <input className="form-input" type="text" placeholder="Örn: B-1001" value={formData.dealerCode} onChange={update('dealerCode')} required id="modal-dealer-code" autoComplete="off" style={{ textTransform: 'uppercase' }} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Kullanıcı Kodu *</label>
                                    <input className="form-input" type="text" placeholder="Örn: ADMIN" value={formData.userCode} onChange={update('userCode')} required id="modal-user-code" autoComplete="off" style={{ textTransform: 'uppercase' }} />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Şifre *</label>
                                    <input className="form-input" type="password" placeholder="En az 6 karakter" value={formData.password} onChange={update('password')} required id="modal-password" autoComplete="new-password" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Şifre Tekrar *</label>
                                    <input className="form-input" type="password" placeholder="Şifreyi tekrarlayın" value={formData.confirmPassword} onChange={update('confirmPassword')} required id="modal-password-confirm" autoComplete="new-password" />
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)} style={{ flex: 1, justifyContent: 'center' }}>İptal</button>
                                <button type="submit" className="btn btn-primary" disabled={formLoading} id="modal-submit" style={{ flex: 2, justifyContent: 'center' }}>
                                    {formLoading ? 'Ekleniyor...' : '+ Firma Ekle'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Edit Credentials Modal */}
            {editModal.show && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1000, padding: 16
                }}>
                    <div style={{
                        background: 'var(--bg-card)', borderRadius: 12, padding: 32,
                        width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                            <h2 style={{ fontSize: 20, fontWeight: 600 }}>Giriş Bilgilerini Düzenle</h2>
                            <button onClick={() => setEditModal({ show: false, company: null })} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: 'var(--text-secondary)' }}>×</button>
                        </div>

                        <p style={{ marginBottom: 20, fontSize: 14, color: 'var(--text-muted)' }}>Müşteri: <strong style={{color: 'var(--text-primary)'}}>{editModal.company?.name}</strong></p>

                        {editMessage.text && (
                            <div style={{ marginBottom: 16, padding: '10px 14px', background: editMessage.type === 'error' ? '#fee2e2' : '#d1fae5', color: editMessage.type === 'error' ? '#dc2626' : '#059669', borderRadius: 8, fontSize: 14 }}>
                                {editMessage.text}
                            </div>
                        )}

                        <form onSubmit={handleEditSubmit} autoComplete="off">
                            <div className="form-group" style={{ marginBottom: 16 }}>
                                <label className="form-label">Bayi Kodu</label>
                                <input className="form-input" type="text" placeholder="B-1000 vs." value={editFormData.dealerCode} onChange={e => setEditFormData(prev => ({ ...prev, dealerCode: e.target.value }))} autoComplete="off" />
                            </div>
                            <div className="form-group" style={{ marginBottom: 16 }}>
                                <label className="form-label">Kullanıcı (Cari) Kodu</label>
                                <input className="form-input" type="text" placeholder="CR001 vs." value={editFormData.userCode} onChange={e => setEditFormData(prev => ({ ...prev, userCode: e.target.value }))} autoComplete="off" />
                            </div>
                            <div className="form-group" style={{ marginBottom: 16 }}>
                                <label className="form-label">Yeni Şifre Belirle (Boş bırakırsanız değişmez)</label>
                                <input className="form-input" type="password" placeholder="******" value={editFormData.password} onChange={e => setEditFormData(prev => ({ ...prev, password: e.target.value }))} autoComplete="new-password" />
                            </div>
                            {editFormData.password && (
                                <div className="form-group" style={{ marginBottom: 24 }}>
                                    <label className="form-label">Yeni Şifre Tekrar</label>
                                    <input className="form-input" type="password" placeholder="******" value={editFormData.confirmPassword} onChange={e => setEditFormData(prev => ({ ...prev, confirmPassword: e.target.value }))} autoComplete="new-password" />
                                </div>
                            )}
                            
                            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
                                <button type="button" className="btn btn-ghost" onClick={() => setEditModal({ show: false, company: null })}>İptal</button>
                                <button type="submit" className="btn btn-primary" disabled={editLoading}>
                                    {editLoading ? 'Kaydediliyor...' : 'Kaydet'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Custom Delete Modal */}
            {deleteModal.show && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1000, padding: 16
                }}>
                    <div style={{
                        background: 'var(--bg-card)', borderRadius: 16, padding: 32,
                        width: '100%', maxWidth: 420, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                        border: '1px solid rgba(220,38,38,0.2)', position: 'relative', overflow: 'hidden'
                    }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'var(--danger)' }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ background: 'rgba(220,38,38,0.1)', color: 'var(--danger)', padding: 12, borderRadius: '50%' }}>
                                    <TrashIcon style={{ width: 24, height: 24 }} />
                                </div>
                                <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Firma Silinecek</h2>
                            </div>
                            <button onClick={() => setDeleteModal({ show: false, company: null, step: 1 })} style={{ height: 32, width: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: 'var(--text-secondary)', borderRadius: 8, transition: '0.2s', ':hover': { background: 'var(--bg-canvas)' } }}>×</button>
                        </div>

                        {deleteModal.step === 1 ? (
                            <>
                                <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 24 }}>
                                    <strong style={{ color: 'var(--text-primary)' }}>{deleteModal.company?.name}</strong> firmasını ve bu firmaya bağlı tüm kullanıcı hesaplarını silmek üzeresiniz.
                                </p>
                                <div style={{ background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.2)', padding: 16, borderRadius: 8, marginBottom: 24 }}>
                                    <p style={{ margin: 0, fontSize: 13, color: 'var(--danger)', fontWeight: 500 }}>⚠️ Bu işlem geri alınamaz. Silinen veriler kurtarılamaz.</p>
                                </div>
                                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                                    <button type="button" className="btn btn-ghost" onClick={() => setDeleteModal({ show: false, company: null, step: 1 })}>İptal</button>
                                    <button type="button" className="btn btn-danger" onClick={() => setDeleteModal(prev => ({ ...prev, step: 2 }))}>Evet, Sil</button>
                                </div>
                            </>
                        ) : (
                            <>
                                <p style={{ fontSize: 16, color: 'var(--text-primary)', fontWeight: 600, textAlign: 'center', marginBottom: 24 }}>
                                    Gerçekten emin misiniz?
                                </p>
                                <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                                    <button type="button" className="btn btn-ghost" onClick={() => setDeleteModal(prev => ({ ...prev, step: 1 }))}>Hayır, Vazgeç</button>
                                    <button type="button" className="btn btn-danger" disabled={loading} onClick={confirmDelete}>
                                        {loading ? 'Siliniyor...' : 'Onaylıyorum, Tamamen Sil'}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
            {/* Risk Limit Modal */}
            {riskModal.show && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1000, padding: 16
                }}>
                    <div style={{
                        background: 'var(--bg-card)', borderRadius: 12, padding: 24,
                        width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <h2 style={{ fontSize: 18, fontWeight: 700 }}>Risk Limiti Belirle</h2>
                            <button onClick={() => setRiskModal({ show: false, company: null, value: '' })} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: 'var(--text-secondary)' }}>×</button>
                        </div>
                        
                        <p style={{ marginBottom: 16, fontSize: 14, color: 'var(--text-secondary)' }}>
                            <strong style={{ color: 'var(--text-primary)' }}>{riskModal.company?.name}</strong> firması için maksimum borçlanma limiti belirleyin.
                        </p>

                        <div className="form-group" style={{ marginBottom: 20 }}>
                            <label className="form-label">Risk Limiti (₺)</label>
                            <input 
                                className="form-input" 
                                type="number" 
                                step="0.01" 
                                value={riskModal.value}
                                onChange={(e) => setRiskModal(prev => ({ ...prev, value: e.target.value }))}
                                placeholder="Örn: 20000"
                                autoFocus
                            />
                            <p style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                                Not: 0 girilirse limit uygulanmaz (Sınırsız).
                            </p>
                        </div>

                        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                            <button type="button" className="btn btn-ghost" onClick={() => setRiskModal({ show: false, company: null, value: '' })}>İptal</button>
                            <button 
                                type="button" 
                                className="btn btn-primary" 
                                disabled={riskLoading}
                                onClick={async () => {
                                    setRiskLoading(true);
                                    try {
                                        const res = await fetch('/api/admin/create-company', {
                                            method: 'PATCH',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ id: riskModal.company.id, risk_limit: riskModal.value })
                                        });
                                        if (res.ok) {
                                            fetchData();
                                            setRiskModal({ show: false, company: null, value: '' });
                                        } else {
                                            const d = await res.json();
                                            alert('Hata: ' + d.error);
                                        }
                                    } catch (e) {
                                        alert('Hata: ' + e.message);
                                    }
                                    setRiskLoading(false);
                                }}
                            >
                                {riskLoading ? 'Kaydediliyor...' : 'Limiti Güncelle'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
