'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
    BuildingOfficeIcon, MagnifyingGlassIcon, LockClosedIcon, LockOpenIcon,
    ExclamationCircleIcon, ArrowLeftStartOnRectangleIcon
} from '@heroicons/react/24/outline';

const statusMap = { pending: 'Bekleyen', approved: 'Onaylı', rejected: 'Reddedildi' };
const statusBadge = { pending: 'badge-warning', approved: 'badge-success', rejected: 'badge-danger' };

const EMPTY_EDIT = {
    companyName: '', taxNumber: '', taxOffice: '', contactPerson: '',
    phone: '', city: '', district: '', address: '', branch: ''
};

export default function RepCompaniesPage() {
    const [companies, setCompanies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });

    const [editModal, setEditModal] = useState({ show: false, company: null });
    const [editFormData, setEditFormData] = useState({ ...EMPTY_EDIT });
    const [editLoading, setEditLoading] = useState(false);
    const [editMessage, setEditMessage] = useState({ type: '', text: '' });

    const [riskModal, setRiskModal] = useState({ show: false, company: null, value: '' });
    const [riskLoading, setRiskLoading] = useState(false);

    const fetchCompanies = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/user/rep-companies');
            if (res.ok) setCompanies(await res.json());
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    }, []);

    useEffect(() => { fetchCompanies(); }, [fetchCompanies]);

    const requestSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const togglePrepaymentLock = async (id, currentValue) => {
        try {
            const res = await fetch('/api/rep/company-update', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, is_prepayment_locked: !currentValue })
            });
            if (!res.ok) {
                const d = await res.json();
                alert('Kilit değiştirilemedi: ' + (d.error || 'Bilinmiyor'));
            }
        } catch (e) {
            alert('Bağlantı hatası: ' + e.message);
        }
        fetchCompanies();
    };

    const enterShowroom = async (companyId) => {
        try {
            const res = await fetch('/api/admin/impersonate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ companyId })
            });
            if (res.ok) {
                if (typeof window !== 'undefined') localStorage.removeItem('b2b_cart');
                window.location.href = `/rep/showroom/${companyId}`;
            } else {
                const d = await res.json();
                alert('Showroom başlatılamadı: ' + d.error);
            }
        } catch (e) {
            alert('Bağlantı hatası: ' + e.message);
        }
    };

    const handleEditOpen = (c) => {
        setEditFormData({
            companyName: c.name || '',
            taxNumber: c.tax_number || '',
            taxOffice: c.tax_office || '',
            contactPerson: c.contact_person || '',
            phone: c.phone || '',
            city: c.city || '',
            district: c.district || '',
            address: c.address || '',
            branch: c.branch || ''
        });
        setEditModal({ show: true, company: c });
        setEditMessage({ type: '', text: '' });
    };

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        setEditMessage({ type: '', text: '' });
        setEditLoading(true);
        try {
            const res = await fetch('/api/rep/company-update', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: editModal.company.id,
                    name: editFormData.companyName,
                    tax_number: editFormData.taxNumber,
                    tax_office: editFormData.taxOffice,
                    contact_person: editFormData.contactPerson,
                    phone: editFormData.phone,
                    city: editFormData.city,
                    district: editFormData.district,
                    address: editFormData.address,
                    branch: editFormData.branch
                })
            });
            if (res.ok) {
                setEditMessage({ type: 'success', text: 'Bilgiler başarıyla güncellendi!' });
                fetchCompanies();
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

    const displayList = (() => {
        const list = companies.filter(c =>
            c.name?.toLowerCase().includes(search.toLowerCase()) ||
            c.tax_number?.includes(search) ||
            c.email?.toLowerCase().includes(search.toLowerCase()) ||
            c.city?.toLowerCase().includes(search.toLowerCase()) ||
            c.dealer_code?.toLowerCase().includes(search.toLowerCase())
        );
        if (sortConfig.key) {
            list.sort((a, b) => {
                let aVal = a[sortConfig.key] || '';
                let bVal = b[sortConfig.key] || '';
                if (typeof aVal === 'string') aVal = aVal.toLocaleLowerCase('tr-TR');
                if (typeof bVal === 'string') bVal = bVal.toLocaleLowerCase('tr-TR');
                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return list;
    })();

    const sortArrow = (key) => sortConfig.key === key ? (sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : '';

    return (
        <div className="page-wrapper">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Firmalar</h1>
                    <p className="page-subtitle">Sorumlu olduğunuz {companies.length} firma</p>
                </div>
            </div>

            <div className="search-bar" style={{ marginBottom: 20 }}>
                <MagnifyingGlassIcon style={{ width: 14, height: 14 }} />
                <input
                    placeholder="Firma adı, vergi no, şehir, bayi kodu..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            {loading ? (
                <div className="loading-center"><div className="loading-spinner" /></div>
            ) : displayList.length === 0 ? (
                <div className="card">
                    <div className="empty-state" style={{ padding: 40 }}>
                        <BuildingOfficeIcon style={{ width: 48, height: 48 }} />
                        <p>Firma bulunamadı.</p>
                    </div>
                </div>
            ) : (
                <div className="card" style={{ padding: 0 }}>
                    <div className="table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th onClick={() => requestSort('name')} style={{ cursor: 'pointer', userSelect: 'none' }}>Firma Adı{sortArrow('name')}</th>
                                    <th onClick={() => requestSort('dealer_code')} style={{ cursor: 'pointer', userSelect: 'none' }}>Bayi Kodu{sortArrow('dealer_code')}</th>
                                    <th onClick={() => requestSort('city')} style={{ cursor: 'pointer', userSelect: 'none' }}>Şehir{sortArrow('city')}</th>
                                    <th onClick={() => requestSort('tax_number')} style={{ cursor: 'pointer', userSelect: 'none' }}>Vergi No{sortArrow('tax_number')}</th>
                                    <th onClick={() => requestSort('contact_person')} style={{ cursor: 'pointer', userSelect: 'none' }}>Yetkili{sortArrow('contact_person')}</th>
                                    <th onClick={() => requestSort('email')} style={{ cursor: 'pointer', userSelect: 'none' }}>E-posta{sortArrow('email')}</th>
                                    <th>Fiyat Grubu</th>
                                    <th onClick={() => requestSort('status')} style={{ cursor: 'pointer', userSelect: 'none' }}>Durum{sortArrow('status')}</th>
                                    <th>İşlemler</th>
                                </tr>
                            </thead>
                            <tbody>
                                {displayList.map(c => (
                                    <tr key={c.id}>
                                        <td style={{ fontWeight: 600 }}>
                                            <Link href={`/rep/companies/${c.id}`} style={{
                                                color: 'var(--brand)',
                                                textDecoration: 'none',
                                                background: 'rgba(56, 189, 248, 0.1)',
                                                border: '1px solid rgba(56, 189, 248, 0.2)',
                                                display: 'inline-flex', alignItems: 'center', gap: 8,
                                                padding: '4px 12px', borderRadius: 6
                                            }}>
                                                {c.name} <span style={{ fontSize: 16 }}>›</span>
                                            </Link>
                                        </td>
                                        <td style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{c.dealer_code || '-'}</td>
                                        <td>{c.city || '-'}</td>
                                        <td style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{c.tax_number}</td>
                                        <td>{c.contact_person || '-'}</td>
                                        <td style={{ color: 'var(--text-secondary)' }}>{c.email || '-'}</td>
                                        <td style={{ color: 'var(--text-secondary)' }}>
                                            {(() => {
                                                const pg = Array.isArray(c.price_group) ? c.price_group[0] : c.price_group;
                                                return pg?.name || '-';
                                            })()}
                                        </td>
                                        <td><span className={`badge ${statusBadge[c.status]}`}>{statusMap[c.status]}</span></td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 6 }}>
                                                <button
                                                    className="btn btn-sm"
                                                    style={{
                                                        backgroundColor: c.is_prepayment_locked ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                                                        borderColor: c.is_prepayment_locked ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)',
                                                        color: c.is_prepayment_locked ? '#dc2626' : '#16a34a',
                                                        padding: '4px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                    }}
                                                    onClick={() => togglePrepaymentLock(c.id, c.is_prepayment_locked)}
                                                    title={c.is_prepayment_locked ? 'Ön Ödeme Zorunlu (Açmak için tıkla)' : 'Ön Ödeme Kapalı (Kilitlemek için tıkla)'}
                                                >
                                                    {c.is_prepayment_locked ? <LockClosedIcon style={{ width: 16, height: 16 }} /> : <LockOpenIcon style={{ width: 16, height: 16 }} />}
                                                </button>
                                                <button
                                                    className="btn btn-sm"
                                                    style={{
                                                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                                                        borderColor: 'rgba(245, 158, 11, 0.3)',
                                                        color: '#d97706', padding: '4px 8px',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                    }}
                                                    onClick={() => setRiskModal({ show: true, company: c, value: c.risk_limit || '0' })}
                                                    title={`Risk Limitini Düzenle (Şu an: ₺${Number(c.risk_limit || 0).toLocaleString('tr-TR')})`}
                                                >
                                                    <ExclamationCircleIcon style={{ width: 16, height: 16 }} />
                                                </button>
                                                <button
                                                    className="btn btn-sm"
                                                    style={{
                                                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                                        borderColor: 'rgba(59, 130, 246, 0.3)',
                                                        color: '#2563eb', padding: '4px 8px',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                    }}
                                                    onClick={() => enterShowroom(c.id)}
                                                    title="Showroom Moduna Gir"
                                                >
                                                    <ArrowLeftStartOnRectangleIcon style={{ width: 16, height: 16 }} />
                                                </button>
                                                <button className="btn btn-ghost btn-sm" onClick={() => handleEditOpen(c)}>✎</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {editModal.show && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
                    <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 32, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                            <h2 style={{ fontSize: 20, fontWeight: 600 }}>Firma Bilgilerini Düzenle</h2>
                            <button onClick={() => setEditModal({ show: false, company: null })} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: 'var(--text-secondary)' }}>×</button>
                        </div>
                        {editMessage.text && (
                            <div style={{ marginBottom: 16, padding: '10px 14px', background: editMessage.type === 'error' ? '#fee2e2' : '#d1fae5', color: editMessage.type === 'error' ? '#dc2626' : '#059669', borderRadius: 8 }}>
                                {editMessage.text}
                            </div>
                        )}
                        <form onSubmit={handleEditSubmit}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}><label className="form-label">Firma Adı</label><input className="form-input" value={editFormData.companyName} onChange={e => setEditFormData({ ...editFormData, companyName: e.target.value })} /></div>
                                <div className="form-group"><label className="form-label">Vergi Numarası</label><input className="form-input" value={editFormData.taxNumber} onChange={e => setEditFormData({ ...editFormData, taxNumber: e.target.value })} /></div>
                                <div className="form-group"><label className="form-label">Vergi Dairesi</label><input className="form-input" value={editFormData.taxOffice} onChange={e => setEditFormData({ ...editFormData, taxOffice: e.target.value })} /></div>
                                <div className="form-group"><label className="form-label">Yetkili Kişi</label><input className="form-input" value={editFormData.contactPerson} onChange={e => setEditFormData({ ...editFormData, contactPerson: e.target.value })} /></div>
                                <div className="form-group"><label className="form-label">Telefon</label><input className="form-input" value={editFormData.phone} onChange={e => setEditFormData({ ...editFormData, phone: e.target.value })} /></div>
                                <div className="form-group"><label className="form-label">İl</label><input className="form-input" value={editFormData.city} onChange={e => setEditFormData({ ...editFormData, city: e.target.value })} /></div>
                                <div className="form-group"><label className="form-label">İlçe</label><input className="form-input" value={editFormData.district} onChange={e => setEditFormData({ ...editFormData, district: e.target.value })} /></div>
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}><label className="form-label">Adres</label><input className="form-input" value={editFormData.address} onChange={e => setEditFormData({ ...editFormData, address: e.target.value })} /></div>
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}><label className="form-label">Branş / Tip</label><input className="form-input" value={editFormData.branch} onChange={e => setEditFormData({ ...editFormData, branch: e.target.value })} /></div>
                            </div>
                            <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
                                <button type="button" className="btn btn-ghost" onClick={() => setEditModal({ show: false, company: null })}>İptal</button>
                                <button type="submit" className="btn btn-primary" disabled={editLoading}>Kaydet</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Risk Limit Modal */}
            {riskModal.show && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
                    <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 32, width: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
                        <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Risk Limiti</h3>
                        <p style={{ marginBottom: 16 }}><strong>{riskModal.company?.name}</strong> için borç limiti (0 = sınırsız):</p>
                        <input type="number" className="form-input" value={riskModal.value} onChange={e => setRiskModal({ ...riskModal, value: e.target.value })} style={{ marginTop: 10 }} />
                        <div style={{ marginTop: 20, display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                            <button className="btn btn-ghost" onClick={() => setRiskModal({ show: false, company: null, value: '' })}>İptal</button>
                            <button className="btn btn-primary" disabled={riskLoading} onClick={async () => {
                                setRiskLoading(true);
                                await fetch('/api/rep/company-update', {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ id: riskModal.company.id, risk_limit: riskModal.value })
                                });
                                fetchCompanies();
                                setRiskModal({ show: false, company: null, value: '' });
                                setRiskLoading(false);
                            }}>Güncelle</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
