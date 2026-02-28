'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

const statusMap = { pending: 'Bekliyor', approved: 'Onaylı', rejected: 'Reddedildi' };
const statusBadge = { pending: 'badge-pending', approved: 'badge-approved', rejected: 'badge-rejected' };

export default function AdminCompanies() {
    const [companies, setCompanies] = useState([]);
    const [priceGroups, setPriceGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [search, setSearch] = useState('');
    const supabase = createClient();

    const fetchData = useCallback(async () => {
        setLoading(true);
        let query = supabase.from('companies').select('*, price_group:price_groups(name)').order('created_at', { ascending: false });
        if (filter !== 'all') query = query.eq('status', filter);
        const { data } = await query;
        const { data: pg } = await supabase.from('price_groups').select('*');
        setCompanies(data || []);
        setPriceGroups(pg || []);
        setLoading(false);
    }, [filter]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const updateStatus = async (id, status) => {
        await supabase.from('companies').update({ status }).eq('id', id);
        fetchData();
    };

    const updatePriceGroup = async (id, price_group_id) => {
        await supabase.from('companies').update({ price_group_id: price_group_id || null }).eq('id', id);
        fetchData();
    };

    const filtered = companies.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
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
        </div>
    );
}
