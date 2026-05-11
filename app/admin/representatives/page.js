'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { UserGroupIcon, PlusIcon, TrashIcon, XMarkIcon, MagnifyingGlassIcon, BuildingOfficeIcon } from '@heroicons/react/24/outline';

const POSITIONS = ['SATIŞ MÜDÜRÜ', 'BÖLGE MÜDÜRÜ', 'SATIŞ TEMSİLCİSİ'];

const EMPTY_FORM = {
    first_name: '',
    last_name: '',
    tc_no: '',
    phone: '',
    email: '',
    position: 'SATIŞ TEMSİLCİSİ',
    dealer_code: '',
    user_code: 'ADMIN',
    password: '',
    confirm_password: '',
    assigned_companies: [] // Array of company IDs
};

export default function AdminRepresentatives() {
    const [reps, setReps] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState(EMPTY_FORM);
    const [formLoading, setFormLoading] = useState(false);
    const [editingId, setEditingId] = useState(null);

    const supabase = createClient();

    const fetchData = useCallback(async () => {
        setLoading(true);
        // 1. Fetch representatives with their assignments
        const { data: repData, error: repError } = await supabase
            .from('customer_representatives')
            .select('*, assignments:representative_assignments(company_id, companies(name))')
            .order('first_name');
        
        if (!repError) setReps(repData || []);

        // 2. Map all current assignments to find which companies are "taken"
        const allAssignments = [];
        repData?.forEach(r => {
            r.assignments?.forEach(a => {
                allAssignments.push({
                    company_id: a.company_id,
                    rep_id: r.id,
                    rep_name: `${r.first_name} ${r.last_name}`
                });
            });
        });

        // 3. Fetch all companies for the selection list
        const { data: compData } = await supabase
            .from('companies')
            .select('id, name')
            .eq('status', 'approved')
            .order('name');
        
        if (compData) {
            const enrichedCompanies = compData.map(c => {
                const assignment = allAssignments.find(a => a.company_id === c.id);
                return {
                    ...c,
                    assigned_to_rep_id: assignment?.rep_id || null,
                    assigned_to_rep_name: assignment?.rep_name || null
                };
            });
            setCompanies(enrichedCompanies);
        }
        setLoading(false);
    }, [supabase]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!editingId && (!formData.dealer_code || !formData.password || !formData.email)) {
            alert('Lütfen giriş bilgilerini (Email, Bayi Kodu, Şifre) eksiksiz doldurun.');
            return;
        }

        if (formData.password !== formData.confirm_password) {
            alert('Şifreler birbiriyle eşleşmiyor.');
            return;
        }

        setFormLoading(true);

        try {
            if (editingId) {
                // UPDATE logic remains client-side for simplicity (only DB fields)
                const { assigned_companies, confirm_password, ...pureData } = formData;
                if (!pureData.password) delete pureData.password;

                const { error } = await supabase.from('customer_representatives').update(pureData).eq('id', editingId);
                if (error) throw error;

                // Sync Assignments
                await supabase.from('representative_assignments').delete().eq('representative_id', editingId);
                if (assigned_companies.length > 0) {
                    const newAssignments = assigned_companies.map(cid => ({
                        representative_id: editingId,
                        company_id: cid
                    }));
                    await supabase.from('representative_assignments').insert(newAssignments);
                }
            } else {
                // CREATE logic uses our new secure API to create Auth User + DB Record
                const res = await fetch('/api/admin/representatives', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });
                const result = await res.json();
                if (!res.ok) throw new Error(result.error || 'Temsilci oluşturulamadı');
            }

            setShowModal(false);
            setEditingId(null);
            setFormData(EMPTY_FORM);
            fetchData();
        } catch (err) {
            alert('Hata: ' + err.message);
        } finally {
            setFormLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Bu temsilciyi silmek istediğinize emin misiniz? Hem sistemden hem de giriş yetkisi tamamen kaldırılacaktır.')) return;
        
        try {
            const res = await fetch(`/api/admin/representatives?id=${id}`, {
                method: 'DELETE'
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error || 'Silme işlemi başarısız');
            fetchData();
        } catch (err) {
            alert('Hata: ' + err.message);
        }
    };

    const handleEdit = (rep) => {
        setEditingId(rep.id);
        setFormData({
            first_name: rep.first_name,
            last_name: rep.last_name,
            tc_no: rep.tc_no || '',
            phone: rep.phone || '',
            email: rep.email || '',
            position: rep.position || 'SATIŞ TEMSİLCİSİ',
            dealer_code: rep.dealer_code || '',
            user_code: rep.user_code || 'ADMIN',
            password: '', // Don't show password for security
            confirm_password: '',
            assigned_companies: rep.assignments?.map(a => a.company_id) || []
        });
        setShowModal(true);
    };

    const toggleCompany = (cid) => {
        setFormData(prev => {
            const current = prev.assigned_companies;
            const next = current.includes(cid) 
                ? current.filter(id => id !== cid) 
                : [...current, cid];
            return { ...prev, assigned_companies: next };
        });
    };

    const filteredReps = reps.filter(r => 
        `${r.first_name} ${r.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
        r.tc_no?.includes(search)
    );

    return (
        <div className="page-wrapper">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Müşteri Temsilcileri</h1>
                    <p className="page-subtitle">Satış ekibi ve sorumlu oldukları firmaların yönetimi</p>
                </div>
                <button className="btn btn-primary" onClick={() => { setEditingId(null); setFormData(EMPTY_FORM); setShowModal(true); }}>
                    <PlusIcon style={{ width: 18, height: 18, marginRight: 8 }} />
                    Temsilci Ekle
                </button>
            </div>

            <div className="search-bar" style={{ marginBottom: 20 }}>
                <MagnifyingGlassIcon style={{ width: 14, height: 14 }} />
                <input placeholder="İsim, TC No ile ara..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>

            {loading ? (
                <div className="loading-center"><div className="loading-spinner" /></div>
            ) : (
                <div className="card" style={{ padding: 0 }}>
                    <div className="table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th>Ad Soyad</th>
                                    <th>TC Kimlik</th>
                                    <th>Pozisyon</th>
                                    <th>İletişim</th>
                                    <th>Sorumlu Firmalar</th>
                                    <th style={{ textAlign: 'right' }}>İşlemler</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredReps.map(rep => (
                                    <tr key={rep.id}>
                                        <td style={{ fontWeight: 600 }}>{rep.first_name} {rep.last_name}</td>
                                        <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{rep.tc_no || '-'}</td>
                                        <td>
                                            <span className="badge" style={{ background: 'var(--bg-canvas)', border: '1px solid var(--border)' }}>
                                                {rep.position}
                                            </span>
                                        </td>
                                        <td style={{ fontSize: 13 }}>
                                            <div>{rep.phone}</div>
                                            <div style={{ color: 'var(--text-muted)' }}>{rep.email}</div>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                                {rep.assignments?.length > 0 ? rep.assignments.map(a => (
                                                    <span key={a.company_id} className="badge badge-primary" style={{ fontSize: 10 }}>{a.companies?.name}</span>
                                                )) : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Atama yok</span>}
                                            </div>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                                <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(rep)}>Düzenle</button>
                                                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(rep.id)}>Sil</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" style={{ maxWidth: 700, width: '95%' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">{editingId ? 'Temsilci Düzenle' : 'Yeni Temsilci Ekle'}</h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}><XMarkIcon style={{ width: 20, height: 20 }} /></button>
                        </div>
                        
                        <form onSubmit={handleSubmit} style={{ padding: 20 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                                <div className="form-group">
                                    <label className="form-label">Adı *</label>
                                    <input className="form-input" required value={formData.first_name} onChange={e => setFormData({...formData, first_name: e.target.value})} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Soyadı *</label>
                                    <input className="form-input" required value={formData.last_name} onChange={e => setFormData({...formData, last_name: e.target.value})} />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                                <div className="form-group">
                                    <label className="form-label">TC Kimlik No</label>
                                    <input className="form-input" maxLength={11} value={formData.tc_no} onChange={e => setFormData({...formData, tc_no: e.target.value})} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Pozisyon</label>
                                    <select className="form-select" value={formData.position} onChange={e => setFormData({...formData, position: e.target.value})}>
                                        {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                                <div className="form-group">
                                    <label className="form-label">Telefon</label>
                                    <input className="form-input" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">E-posta</label>
                                    <input className="form-input" type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                                </div>
                            </div>

                            <div style={{ padding: '12px 0', borderTop: '1px solid var(--border)', marginTop: 8 }}>
                                <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary)', marginBottom: 16 }}>Sisteme Giriş Bilgileri (Login)</h4>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                                    <div className="form-group">
                                        <label className="form-label">Bayi Kodu *</label>
                                        <input className="form-input" placeholder="Örn: TEM-1001" required value={formData.dealer_code} onChange={e => setFormData({...formData, dealer_code: e.target.value.toUpperCase()})} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Kullanıcı Kodu *</label>
                                        <input className="form-input" required value={formData.user_code} onChange={e => setFormData({...formData, user_code: e.target.value.toUpperCase()})} />
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                    <div className="form-group">
                                        <label className="form-label">{editingId ? 'Yeni Şifre (Değiştirmek istemiyorsanız boş bırakın)' : 'Şifre *'}</label>
                                        <input className="form-input" type="password" required={!editingId} value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{editingId ? 'Yeni Şifre Tekrar' : 'Şifre Tekrar *'}</label>
                                        <input className="form-input" type="password" required={!editingId} value={formData.confirm_password} onChange={e => setFormData({...formData, confirm_password: e.target.value})} />
                                    </div>
                                </div>
                            </div>

                            <div className="form-group" style={{ marginBottom: 0, marginTop: 16 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <label className="form-label" style={{ marginBottom: 0 }}>Sorumlu Olacağı Firmalar</label>
                                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer', color: 'var(--primary)', fontWeight: 600 }}>
                                            <input 
                                                type="checkbox" 
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        const availableIds = companies
                                                            .filter(c => !c.assigned_to_rep_id || c.assigned_to_rep_id === editingId)
                                                            .map(c => c.id);
                                                        setFormData(prev => ({ ...prev, assigned_companies: availableIds }));
                                                    } else {
                                                        setFormData(prev => ({ ...prev, assigned_companies: [] }));
                                                    }
                                                }}
                                                style={{ width: 13, height: 13 }}
                                            />
                                            Boştaki Tümünü Seç
                                        </label>
                                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formData.assigned_companies.length} firma seçildi</span>
                                    </div>
                                </div>
                                <div style={{ 
                                    maxHeight: 200, 
                                    overflowY: 'auto', 
                                    border: '1px solid var(--border)', 
                                    borderRadius: 12, 
                                    padding: 12,
                                    background: 'var(--bg-secondary)',
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr',
                                    gap: 8
                                }}>
                                    {companies.map(c => {
                                        const isTaken = c.assigned_to_rep_id && c.assigned_to_rep_id !== editingId;
                                        const isSelected = formData.assigned_companies.includes(c.id);
                                        
                                        return (
                                            <label key={c.id} style={{ 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                gap: 8, 
                                                fontSize: 12, 
                                                cursor: isTaken ? 'not-allowed' : 'pointer',
                                                padding: '6px 8px',
                                                borderRadius: 6,
                                                background: isSelected ? 'rgba(37,99,235,0.1)' : (isTaken ? 'rgba(0,0,0,0.05)' : 'transparent'),
                                                border: isSelected ? '1px solid var(--primary)' : '1px solid transparent',
                                                opacity: isTaken ? 0.6 : 1,
                                                transition: 'all 0.2s'
                                            }}>
                                                <input 
                                                    type="checkbox" 
                                                    checked={isSelected} 
                                                    disabled={isTaken}
                                                    onChange={() => !isTaken && toggleCompany(c.id)}
                                                    style={{ width: 14, height: 14 }}
                                                />
                                                <span style={{ 
                                                    fontWeight: isSelected ? 600 : 400,
                                                    color: isTaken ? 'var(--text-muted)' : 'inherit'
                                                }}>
                                                    {c.name} {isTaken && `(Dolu - ${c.assigned_to_rep_name})`}
                                                </span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="modal-footer" style={{ marginTop: 24, padding: 0, border: 'none' }}>
                                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>İptal</button>
                                <button type="submit" className="btn btn-primary" disabled={formLoading}>
                                    {formLoading ? 'Kaydediliyor...' : (editingId ? 'Güncelle' : 'Temsilciyi Ekle')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
