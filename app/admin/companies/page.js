'use client';
import { useState, useEffect, useCallback } from 'react';

const statusMap = { pending: 'Bekliyor', approved: 'Onaylı', rejected: 'Reddedildi' };
const statusBadge = { pending: 'badge-pending', approved: 'badge-approved', rejected: 'badge-rejected' };
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

    useEffect(() => { fetchData(); }, [fetchData]);

    const updateStatus = async (id, status) => {
        await fetch('/api/admin/create-company', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, status })
        });
        fetchData();
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
                    {['all', 'pending', 'approved', 'rejected'].map(f => (
                        <button key={f} className={`tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
                            {f === 'all' ? 'Tümü' : statusMap[f]}
                        </button>
                    ))}
                </div>
                <div className="search-bar">
                    <span className="search-icon">🔍</span>
                    <input placeholder="Firma adı, vergi no, e-posta..." value={search} onChange={e => setSearch(e.target.value)} id="companies-search" />
                </div>
            </div>

            {loading ? (
                <div className="loading-center"><div className="loading-spinner" /></div>
            ) : filtered.length === 0 ? (
                <div className="card"><div className="empty-state"><div className="empty-state-icon">🏢</div><div className="empty-state-title">Firma bulunamadı</div></div></div>
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
                                    <td style={{ fontWeight: 600 }}>{c.name}</td>
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
                                                <button className="btn btn-danger btn-sm" onClick={() => updateStatus(c.id, 'rejected')} id={`reject-${c.id}`}>✗ Reddet</button>
                                            )}
                                            {c.status !== 'pending' && (
                                                <button className="btn btn-ghost btn-sm" onClick={() => updateStatus(c.id, 'pending')} id={`pending-${c.id}`}>↩ Beklet</button>
                                            )}
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
        </div>
    );
}
