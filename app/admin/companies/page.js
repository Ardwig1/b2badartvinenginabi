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
  
  // EDIT MODAL STATE
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
    fetchData();
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

  const handleAddCompany = async (e) => {
    e.preventDefault();
    setFormError(''); setFormSuccess('');
    if (formData.password !== formData.confirmPassword) {
      setFormError('Şifreler eşleşmiyor.'); return;
    }
    setFormLoading(true);
    try {
      const res = await fetch('/api/admin/create-company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setFormSuccess('Firma başarıyla eklendi!');
        fetchData();
        setTimeout(() => setShowModal(false), 2000);
      } else {
        const result = await res.json();
        setFormError(result.error || 'Bir hata oluştu.');
      }
    } catch (err) { setFormError(err.message); }
    setFormLoading(false);
  };

  const sortedAndFiltered = useCallback(() => {
    const list = companies.filter(c => 
      c.name?.toLowerCase().includes(search.toLowerCase()) || 
      c.tax_number?.includes(search) ||
      c.dealer_code?.toLowerCase().includes(search.toLowerCase())
    );
    if (sortConfig.key) {
      list.sort((a, b) => {
        let aVal = (a[sortConfig.key] || '').toString().toLocaleLowerCase('tr-TR');
        let bVal = (b[sortConfig.key] || '').toString().toLocaleLowerCase('tr-TR');
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
        <button className="btn btn-primary" onClick={() => { setShowModal(true); setFormError(''); setFormData(EMPTY_FORM); }}>+ Firma Ekle</button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <div className="tabs">
          {['all', 'pending', 'approved', 'rejected', 'history'].map(f => (
            <button key={f} className={`tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>{statusMap[f]}</button>
          ))}
        </div>
      </div>

      {filter !== 'history' && (
        <div className="search-bar" style={{ marginBottom: 20 }}>
          <MagnifyingGlassIcon style={{ width: 14, height: 14 }} />
          <input placeholder="Firma adı, vergi no, bayi kodu..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      )}

      {loading ? (
        <div className="loading-center"><div className="loading-spinner" /></div>
      ) : filter === 'history' ? (
        <div className="card" style={{ padding: 0 }}>
            <div className="table-wrapper">
              <table>
                <thead><tr><th>Firma</th><th>Tarih</th><th>İşlem</th><th>Detay</th></tr></thead>
                <tbody>
                  {activities.map(act => (
                    <tr key={act.id}>
                      <td style={{ fontWeight: 600 }}>{act.companies?.name}</td>
                      <td>{new Date(act.created_at).toLocaleString('tr-TR')}</td>
                      <td>{act.action_type}</td>
                      <td>{JSON.stringify(act.details)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th onClick={() => requestSort('name')} style={{ cursor: 'pointer' }}>Firma Adı</th>
                  <th>Bayi Kodu</th>
                  <th>Şehir</th>
                  <th>Yetkili</th>
                  <th>Fiyat Grubu</th>
                  <th>Durum</th>
                  <th>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {displayList.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}><Link href={`/admin/companies/${c.id}`} className="btn btn-ghost btn-sm" style={{ color: 'var(--brand)' }}>{c.name} ›</Link></td>
                    <td style={{ fontWeight: 600 }}>{c.dealer_code || '-'}</td>
                    <td>{c.city || '-'}</td>
                    <td>{c.contact_person || '-'}</td>
                    <td>
                      <select className="form-select" style={{ fontSize: 12 }} value={c.price_group_id || ''} onChange={e => updatePriceGroup(c.id, e.target.value)}>
                        <option value="">-</option>
                        {priceGroups.map(pg => <option key={pg.id} value={pg.id}>{pg.name}</option>)}
                      </select>
                    </td>
                    <td><span className={`badge ${statusBadge[c.status]}`}>{statusMap[c.status]}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-sm" onClick={() => enterShowroom(c.id)} title="Showroom"><ArrowLeftStartOnRectangleIcon style={{ width: 16, height: 16 }} /></button>
                        <button className="btn btn-sm" onClick={() => setRiskModal({ show: true, company: c, value: c.risk_limit || '0' })}><ExclamationCircleIcon style={{ width: 16, height: 16 }} /></button>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleEditOpen(c)}>✎</button>
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => {
                            setDeleteModal({ show: true, company: c, step: 1 });
                        }}>🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Firma Ekle Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 32, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h2 style={{ fontSize: 20, fontWeight: 600 }}>Yeni Firma Ekle</h2>
                <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer' }}>×</button>
            </div>
            <form onSubmit={handleAddCompany}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ gridColumn: '1 / -1' }}><label className="form-label">Firma Adı *</label><input className="form-input" required value={formData.companyName} onChange={e => setFormData({...formData, companyName: e.target.value})} /></div>
                <div><label className="form-label">Vergi No *</label><input className="form-input" required value={formData.taxNumber} onChange={e => setFormData({...formData, taxNumber: e.target.value})} /></div>
                <div><label className="form-label">Vergi Dairesi</label><input className="form-input" value={formData.taxOffice} onChange={e => setFormData({...formData, taxOffice: e.target.value})} /></div>
                <div><label className="form-label">Yetkili Kişi *</label><input className="form-input" required value={formData.contactPerson} onChange={e => setFormData({...formData, contactPerson: e.target.value})} /></div>
                <div><label className="form-label">E-posta (Arka Plan İçin) *</label><input className="form-input" type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} /></div>
                <div><label className="form-label">Telefon</label><input className="form-input" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} /></div>
                <div><label className="form-label">İl</label><input className="form-input" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} /></div>
                <div><label className="form-label">İlçe</label><input className="form-input" value={formData.district} onChange={e => setFormData({...formData, district: e.target.value})} /></div>
                <div style={{ gridColumn: '1 / -1' }}><label className="form-label">Adres</label><input className="form-input" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} /></div>
                <div style={{ gridColumn: '1 / -1' }}><label className="form-label">Branş / Tip</label><input className="form-input" value={formData.branch} onChange={e => setFormData({...formData, branch: e.target.value})} /></div>
                <div style={{ gridColumn: '1 / -1', marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 16 }}><h3>Giriş Bilgileri</h3></div>
                <div><label className="form-label">Bayi Kodu *</label><input className="form-input" required value={formData.dealerCode} onChange={e => setFormData({...formData, dealerCode: e.target.value.toUpperCase()})} /></div>
                <div><label className="form-label">Kullanıcı Kodu *</label><input className="form-input" required value={formData.userCode} onChange={e => setFormData({...formData, userCode: e.target.value})} /></div>
                <div><label className="form-label">Şifre *</label><input className="form-input" type="password" required value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} /></div>
                <div><label className="form-label">Şifre Tekrar *</label><input className="form-input" type="password" required value={formData.confirmPassword} onChange={e => setFormData({...formData, confirmPassword: e.target.value})} /></div>
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 24 }}><button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowModal(false)}>İptal</button><button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={formLoading}>+ Firma Ekle</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Firma Düzenle Modal (DESIGN MATCHED TO ADD MODAL) */}
      {editModal.show && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 32, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 600 }}>Firma Bilgilerini Düzenle</h2>
              <button onClick={() => setEditModal({ show: false, company: null })} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer' }}>×</button>
            </div>
            {editMessage.text && <div style={{ marginBottom: 16, padding: '10px 14px', background: editMessage.type === 'error' ? '#fee2e2' : '#d1fae5', color: editMessage.type === 'error' ? '#dc2626' : '#059669', borderRadius: 8 }}>{editMessage.text}</div>}
            <form onSubmit={handleEditSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ gridColumn: '1 / -1' }}><label className="form-label">Firma Adı</label><input className="form-input" value={editFormData.companyName} onChange={e => setEditFormData({...editFormData, companyName: e.target.value})} /></div>
                <div><label className="form-label">Vergi Numarası</label><input className="form-input" value={editFormData.taxNumber} onChange={e => setEditFormData({...editFormData, taxNumber: e.target.value})} /></div>
                <div><label className="form-label">Vergi Dairesi</label><input className="form-input" value={editFormData.taxOffice} onChange={e => setEditFormData({...editFormData, taxOffice: e.target.value})} /></div>
                <div><label className="form-label">Yetkili Kişi</label><input className="form-input" value={editFormData.contactPerson} onChange={e => setEditFormData({...editFormData, contactPerson: e.target.value})} /></div>
                <div><label className="form-label">E-posta (Arka Plan İçin)</label><input className="form-input" type="email" value={editFormData.email} onChange={e => setEditFormData({...editFormData, email: e.target.value})} /></div>
                <div><label className="form-label">Telefon</label><input className="form-input" value={editFormData.phone} onChange={e => setEditFormData({...editFormData, phone: e.target.value})} /></div>
                <div><label className="form-label">İl</label><input className="form-input" value={editFormData.city} onChange={e => setEditFormData({...editFormData, city: e.target.value})} /></div>
                <div><label className="form-label">İlçe</label><input className="form-input" value={editFormData.district} onChange={e => setEditFormData({...editFormData, district: e.target.value})} /></div>
                <div style={{ gridColumn: '1 / -1' }}><label className="form-label">Adres</label><input className="form-input" value={editFormData.address} onChange={e => setEditFormData({...editFormData, address: e.target.value})} /></div>
                <div style={{ gridColumn: '1 / -1' }}><label className="form-label">Branş / Tip</label><input className="form-input" value={editFormData.branch} onChange={e => setEditFormData({...editFormData, branch: e.target.value})} /></div>
                
                <div style={{ gridColumn: '1 / -1', marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 16 }}><h3>Sisteme Giriş Bilgileri (Login)</h3></div>
                <div><label className="form-label">Bayi Kodu</label><input className="form-input" value={editFormData.dealerCode} onChange={e => setEditFormData({...editFormData, dealerCode: e.target.value.toUpperCase()})} /></div>
                <div><label className="form-label">Kullanıcı Kodu</label><input className="form-input" value={editFormData.userCode} onChange={e => setEditFormData({...editFormData, userCode: e.target.value})} /></div>
                <div><label className="form-label">Yeni Şifre Belirle</label><input className="form-input" type="password" value={editFormData.password} onChange={e => setEditFormData({...editFormData, password: e.target.value})} placeholder="Değişmeyecekse boş bırakın" /></div>
                {editFormData.password && <div><label className="form-label">Şifre Tekrar</label><input className="form-input" type="password" value={editFormData.confirmPassword} onChange={e => setEditFormData({...editFormData, confirmPassword: e.target.value})} /></div>}
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}><button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setEditModal({ show: false, company: null })}>İptal</button><button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={editLoading}>Kaydet</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Delete and Risk Modals */}
      {deleteModal.show && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 32, width: 400, textAlign: 'center' }}>
            <TrashIcon style={{ width: 48, height: 48, color: 'var(--danger)', margin: '0 auto 16px' }} />
            <h3>Firma Silinecek</h3>
            <p><strong>{deleteModal.company?.name}</strong> silinecek. Emin misiniz?</p>
            <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'center' }}><button className="btn btn-ghost" onClick={() => setDeleteModal({ show: false, company: null, step: 1 })}>İptal</button><button className="btn btn-danger" onClick={confirmDelete}>Evet, Sil</button></div>
          </div>
        </div>
      )}

      {riskModal.show && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 32, width: 400 }}>
            <h3>Risk Limiti</h3>
            <p><strong>{riskModal.company?.name}</strong> için borç limiti (0 = sınırsız):</p>
            <input type="number" className="form-input" style={{ marginTop: 16 }} value={riskModal.value} onChange={e => setRiskModal({...riskModal, value: e.target.value})} />
            <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}><button className="btn btn-ghost" onClick={() => setRiskModal({ show: false, company: null, value: '' })}>İptal</button><button className="btn btn-primary" disabled={riskLoading} onClick={async () => {
              setRiskLoading(true);
              await fetch('/api/admin/create-company', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: riskModal.company.id, risk_limit: riskModal.value }) });
              fetchData(); setRiskModal({ show: false, company: null, value: '' }); setRiskLoading(false);
            }}>Güncelle</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
