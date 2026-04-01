'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  BuildingOfficeIcon,
  MagnifyingGlassIcon, 
  ClockIcon, 
  TrashIcon, 
  CheckCircleIcon, 
  XCircleIcon,
  ExclamationCircleIcon,
  LockClosedIcon,
  LockOpenIcon,
  ArrowLeftStartOnRectangleIcon
} from '@heroicons/react/24/outline';

const statusMap = {
  all: 'Tümü',
  pending: 'Bekleyen',
  approved: 'Onaylı',
  rejected: 'Reddedildi',
  history: 'İşlem Geçmişi'
};

const statusBadge = {
  pending: 'badge-warning',
  approved: 'badge-success',
  rejected: 'badge-danger',
  history: 'badge-info'
};

const EMPTY_FORM = {
  companyName: '',
  taxNumber: '',
  taxOffice: '',
  contactPerson: '',
  email: '',
  phone: '',
  city: '',
  district: '',
  address: '',
  branch: '',
  dealerCode: '',
  userCode: '',
  password: '',
  confirmPassword: ''
};

export default function CompaniesPage() {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [companies, setCompanies] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [priceGroups, setPriceGroups] = useState([]);
  
  // Edit Modal States - FULL FIELDS
  const [editModal, setEditModal] = useState({ show: false, company: null });
  const [editFormData, setEditFormData] = useState({ ...EMPTY_FORM });
  const [editLoading, setEditLoading] = useState(false);
  const [editMessage, setEditMessage] = useState({ type: '', text: '' });

  // Delete Modal States
  const [deleteModal, setDeleteModal] = useState({ show: false, company: null, step: 1 });

  // Risk Limit Modal States
  const [riskModal, setRiskModal] = useState({ show: false, company: null, value: '' });
  const [riskLoading, setRiskLoading] = useState(false);

  // Sorting State
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

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
        alert(`Kilit değiştirilemedi!\nSistem Hatası: ${data.error || 'Bilinmiyor'}`);
      }
    } catch (e) {
      alert(`İletişim Hatası: ${e.message}`);
    }
    fetchData(); // refresh UI
  };

  const enterShowroom = async (companyId) => {
    try {
      const res = await fetch('/api/admin/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId })
      });
      if (res.ok) {
        router.push(`/admin/showroom/${companyId}`);
      } else {
        const d = await res.json();
        alert('Showroom başlatılamadı: ' + d.error);
      }
    } catch (e) {
      alert('İletişim hatası: ' + e.message);
    }
  };

  const updatePriceGroup = async (id, price_group_id) => {
    await fetch('/api/admin/create-company', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, price_group_id })
    });
    fetchData();
  };

  const autoFillDealerCode = async (city) => {
    const trimmedCity = city?.trim();
    if (!trimmedCity || trimmedCity.length < 2) return;
    
    // Autofill if dealerCode is empty OR it looks like one of our auto-generated codes (has a dash)
    const currentCode = formData.dealerCode || '';
    if (!currentCode || currentCode.includes('-')) {
      try {
        const res = await fetch(`/api/admin/next-dealer-code?city=${encodeURIComponent(trimmedCity)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.nextCode) {
            const code = data.nextCode;
            const email = `${code.toLowerCase()}@${code.toLowerCase()}.com`;
            setFormData(prev => ({ ...prev, dealerCode: code, email: email }));
          }
        }
      } catch (e) {
        console.error('Bayi kodu oluşturma hatası:', e);
      }
    }
  };

  const update = (field) => (e) => {
    const value = e.target.value;
    setFormData(prev => {
        const next = { ...prev, [field]: value };
        // Chain: Dealer Code -> Email
        if (field === 'dealerCode') {
            const cleanCode = value.trim().toLowerCase();
            if (cleanCode) {
                next.email = `${cleanCode}@${cleanCode}.com`;
            }
        }
        return next;
    });
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
        const error = await res.json();
        alert('Hata: ' + error.message);
      }
    } catch (e) {
      alert('Hata: ' + e.message);
    }
    setLoading(false);
  };

  const handleEditOpen = (c) => {
    setEditFormData({
      companyName: c.name || '',
      taxNumber: c.tax_number || '',
      taxOffice: c.tax_office || '',
      contactPerson: c.contact_person || '',
      email: c.email || '',
      phone: c.phone || '',
      city: c.city || '',
      district: c.district || '',
      address: c.address || '',
      branch: c.branch || '',
      dealerCode: c.dealer_code || '',
      userCode: c.user_code || '',
      password: '',
      confirmPassword: ''
    });
    setEditModal({ show: true, company: c });
    setEditMessage({ type: '', text: '' });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setEditMessage({ type: '', text: '' });

    if (editFormData.password && editFormData.password !== editFormData.confirmPassword) {
      setEditMessage({ type: 'error', text: 'Şifreler eşleşmiyor!' });
      return;
    }

    setEditLoading(true);
    try {
      const res = await fetch('/api/admin/create-company', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editModal.company.id,
          name: editFormData.companyName,
          tax_number: editFormData.taxNumber,
          tax_office: editFormData.taxOffice,
          contact_person: editFormData.contactPerson,
          email: editFormData.email,
          phone: editFormData.phone,
          city: editFormData.city,
          district: editFormData.district,
          address: editFormData.address,
          branch: editFormData.branch,
          dealer_code: editFormData.dealerCode,
          user_code: editFormData.userCode,
          password: editFormData.password || undefined
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

  const sortedAndFiltered = useCallback(() => {
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
  }, [companies, search, sortConfig]);

  const displayList = sortedAndFiltered();

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <div>
          <h1 className="page-title">Firma Yönetimi</h1>
          <p className="page-subtitle">Kayıtlı firmalar ve onay işlemleri</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowModal(true); setFormError(''); setFormSuccess(''); setFormData(EMPTY_FORM); }} id="add-comp">
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
      </div>
      {filter !== 'history' && (
        <div className="search-bar">
          <MagnifyingGlassIcon style={{ width: 14, height: 14 }} />
          <input placeholder="Firma adı, vergi no, şehir, bayi kodu..." value={search} onChange={e => setSearch(e.target.value)} id="companies-search" />
        </div>
      )}

      {loading ? (
        <div className="loading-center"><div className="loading-spinner" /></div>
      ) : filter === 'history' ? (
        <div className="card" style={{ padding: 0 }}>
          {activities.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}><ClockIcon style={{ width: 32, height: 32 }} /><p>Geçmiş bulunamadı.</p></div>
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
      ) : (
        <div className="card" style={{ padding: 0 }}>
          {displayList.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}><BuildingOfficeIcon style={{ width: 32, height: 32 }} /></div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th onClick={() => requestSort('name')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Firma Adı {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th onClick={() => requestSort('dealer_code')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Bayi Kodu {sortConfig.key === 'dealer_code' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th onClick={() => requestSort('city')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Şehir {sortConfig.key === 'city' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th onClick={() => requestSort('tax_number')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Vergi No {sortConfig.key === 'tax_number' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th onClick={() => requestSort('contact_person')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Yetkili {sortConfig.key === 'contact_person' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th onClick={() => requestSort('email')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      E-posta {sortConfig.key === 'email' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th>Fiyat Grubu</th>
                    <th onClick={() => requestSort('status')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Durum {sortConfig.key === 'status' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th>İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {displayList.map(c => (
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
                          <span style={{ fontSize: 16 }}>›</span>
                        </Link>
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{c.dealer_code || '-'}</td>
                      <td>{c.city || '-'}</td>
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
                            <button className="btn btn-success btn-sm" onClick={() => updateStatus(c.id, 'approved')} id={`approve-${c.id}`}>✓ Onay</button>
                          )}
                          {c.status !== 'rejected' && (
                            <button className="btn btn-danger btn-sm" onClick={() => updateStatus(c.id, 'rejected')} id={`reject-${c.id}`}>X Uzaklaştır</button>
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
                            title={`Risk Limitini Düzenle (Şu an: PŞ${Number(c.risk_limit || 0).toLocaleString('tr-TR')})`}
                          >
                            <ExclamationCircleIcon style={{ width: 16, height: 16 }} />
                          </button>
                          <button 
                            className="btn btn-sm"
                            style={{ 
                              backgroundColor: 'rgba(59, 130, 246, 0.1)',
                              borderColor: 'rgba(59, 130, 246, 0.3)',
                              color: '#2563eb',
                              padding: '4px 8px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                            onClick={() => enterShowroom(c.id)}
                            title="Firmaya Giriş Yap (Showroom)"
                          >
                            <ArrowLeftStartOnRectangleIcon style={{ width: 16, height: 16 }} />
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => handleEditOpen(c)}>✎</button>
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => setDeleteModal({ show: true, company: c, step: 1 })}>🗑</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL: ADD COMPANY */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 32, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h2 style={{ fontSize: 20, fontWeight: 600 }}>Yeni Firma Ekle</h2>
                <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: 'var(--text-secondary)' }}>×</button>
            </div>
            {formError && <div style={{ marginBottom: 16, padding: '10px 14px', background: '#fee2e2', color: '#dc2626', borderRadius: 8 }}>{formError}</div>}
            {formSuccess && <div style={{ marginBottom: 16, padding: '10px 14px', background: '#d1fae5', color: '#059669', borderRadius: 8 }}>{formSuccess}</div>}
            <form onSubmit={handleAddCompany}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ gridColumn: '1 / -1' }}><label className="form-label">Firma Adı *</label><input className="form-input" required value={formData.companyName} onChange={update('companyName')} /></div>
                <div><label className="form-label">Vergi No *</label><input className="form-input" required value={formData.taxNumber} onChange={update('taxNumber')} /></div>
                <div><label className="form-label">Vergi Dairesi</label><input className="form-input" value={formData.taxOffice} onChange={update('taxOffice')} /></div>
                <div><label className="form-label">Yetkili Kişi *</label><input className="form-input" required value={formData.contactPerson} onChange={update('contactPerson')} /></div>
                <div><label className="form-label">E-posta (Arka Plan İçin) *</label><input className="form-input" type="email" required value={formData.email} onChange={update('email')} /></div>
                <div><label className="form-label">Telefon</label><input className="form-input" value={formData.phone} onChange={update('phone')} /></div>
                <div><label className="form-label">İl</label><input className="form-input" value={formData.city} onChange={update('city')} onBlur={(e) => autoFillDealerCode(e.target.value)} /></div>
                <div><label className="form-label">İlçe</label><input className="form-input" value={formData.district} onChange={update('district')} /></div>
                <div style={{ gridColumn: '1 / -1' }}><label className="form-label">Adres</label><input className="form-input" value={formData.address} onChange={update('address')} /></div>
                <div style={{ gridColumn: '1 / -1' }}><label className="form-label">Branş / Tip</label><input className="form-input" value={formData.branch} onChange={update('branch')} /></div>
                <div style={{ gridColumn: '1 / -1', marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 16 }}><h3>Sisteme Giriş Bilgileri (Login)</h3></div>
                <div><label className="form-label">Bayi Kodu *</label><input className="form-input" required value={formData.dealerCode} onChange={update('dealerCode')} /></div>
                <div><label className="form-label">Kullanıcı Kodu *</label><input className="form-input" required value={formData.userCode} onChange={update('userCode')} /></div>
                <div><label className="form-label">Şifre *</label><input className="form-input" type="password" required value={formData.password} onChange={update('password')} /></div>
                <div><label className="form-label">Şifre Tekrar *</label><input className="form-input" type="password" required value={formData.confirmPassword} onChange={update('confirmPassword')} /></div>
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 24 }}><button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowModal(false)}>İptal</button><button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={formLoading}>+ Firma Ekle</button></div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT COMPANY (MATCHING IMAGE 2) */}
      {editModal.show && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 32, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 600 }}>Firma Bilgilerini Düzenle</h2>
              <button onClick={() => setEditModal({ show: false, company: null })} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: 'var(--text-secondary)' }}>×</button>
            </div>
            {editMessage.text && <div style={{ marginBottom: 16, padding: '10px 14px', background: editMessage.type === 'error' ? '#fee2e2' : '#d1fae5', color: editMessage.type === 'error' ? '#dc2626' : '#059669', borderRadius: 8 }}>{editMessage.text}</div>}
            <form onSubmit={handleEditSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}><label className="form-label">Firma Adı</label><input className="form-input" value={editFormData.companyName} onChange={e => setEditFormData({...editFormData, companyName: e.target.value})} /></div>
                <div className="form-group"><label className="form-label">Vergi Numarası</label><input className="form-input" value={editFormData.taxNumber} onChange={e => setEditFormData({...editFormData, taxNumber: e.target.value})} /></div>
                <div className="form-group"><label className="form-label">Vergi Dairesi</label><input className="form-input" value={editFormData.taxOffice} onChange={e => setEditFormData({...editFormData, taxOffice: e.target.value})} /></div>
                <div className="form-group"><label className="form-label">Yetkili Kişi</label><input className="form-input" value={editFormData.contactPerson} onChange={e => setEditFormData({...editFormData, contactPerson: e.target.value})} /></div>
                <div className="form-group"><label className="form-label">E-posta (Arka Plan İçin)</label><input className="form-input" type="email" value={editFormData.email} onChange={e => setEditFormData({...editFormData, email: e.target.value})} /></div>
                <div className="form-group"><label className="form-label">Telefon</label><input className="form-input" value={editFormData.phone} onChange={e => setEditFormData({...editFormData, phone: e.target.value})} /></div>
                <div className="form-group"><label className="form-label">İl</label><input className="form-input" value={editFormData.city} onChange={e => setEditFormData({...editFormData, city: e.target.value})} /></div>
                <div className="form-group"><label className="form-label">İlçe</label><input className="form-input" value={editFormData.district} onChange={e => setEditFormData({...editFormData, district: e.target.value})} /></div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}><label className="form-label">Adres</label><input className="form-input" type="text" value={editFormData.address} onChange={e => setEditFormData({...editFormData, address: e.target.value})} /></div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}><label className="form-label">Branş / Tip</label><input className="form-input" type="text" value={editFormData.branch} onChange={e => setEditFormData({...editFormData, branch: e.target.value})} /></div>
                
                <div style={{ gridColumn: '1 / -1', marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 16 }}><h3>Sisteme Giriş Bilgileri (Login)</h3></div>
                <div className="form-group"><label className="form-label">Bayi Kodu</label><input className="form-input" value={editFormData.dealerCode} onChange={e => {
                    const val = e.target.value.toUpperCase();
                    const email = `${val.toLowerCase()}@${val.toLowerCase()}.com`;
                    setEditFormData({...editFormData, dealerCode: val, email: email});
                }} /></div>
                <div className="form-group"><label className="form-label">Kullanıcı Kodu</label><input className="form-input" value={editFormData.userCode} onChange={e => setEditFormData({...editFormData, userCode: e.target.value})} /></div>
                <div className="form-group"><label className="form-label">Yeni Şifre Belirle (Boş bırakırsanız değişmez)</label><input className="form-input" type="password" value={editFormData.password} onChange={e => setEditFormData({...editFormData, password: e.target.value})} autoComplete="new-password" /></div>
                {editFormData.password && (
                  <div className="form-group">
                      <label className="form-label">Yeni Şifre Tekrar</label>
                      <input className="form-input" type="password" value={editFormData.confirmPassword} onChange={e => setEditFormData({...editFormData, confirmPassword: e.target.value})} autoComplete="new-password" />
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setEditModal({ show: false, company: null })}>İptal</button>
                <button type="submit" className="btn btn-primary" disabled={editLoading}>Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteModal.show && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 32, width: 400, textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <TrashIcon style={{ width: 48, height: 48, color: 'var(--danger)', margin: '0 auto 16px' }} />
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Firma Silinecek</h3>
            <p style={{ marginBottom: 24 }}><strong>{deleteModal.company?.name}</strong> silinecek. Emin misiniz?</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button className="btn btn-ghost" onClick={() => setDeleteModal({ show: false, company: null, step: 1 })}>İptal</button>
              <button className="btn btn-danger" onClick={confirmDelete}>Evet, Sil</button>
            </div>
          </div>
        </div>
      )}

      {/* Risk Limit Modal */}
      {riskModal.show && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 32, width: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Risk Limiti</h3>
            <p style={{ marginBottom: 16 }}><strong>{riskModal.company?.name}</strong> için borç limiti (0 = sınırsız):</p>
            <input type="number" className="form-input" value={riskModal.value} onChange={e => setRiskModal({...riskModal, value: e.target.value})} style={{ marginTop: 10 }} />
            <div style={{ marginTop: 20, display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setRiskModal({ show: false, company: null, value: '' })}>İptal</button>
              <button className="btn btn-primary" disabled={riskLoading} onClick={async () => {
                setRiskLoading(true);
                await fetch('/api/admin/create-company', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: riskModal.company.id, risk_limit: riskModal.value }) });
                fetchData(); setRiskModal({ show: false, company: null, value: '' }); setRiskLoading(false);
              }}>Güncelle</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
