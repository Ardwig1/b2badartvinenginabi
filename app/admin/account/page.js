'use client';
import { useState, useEffect, useCallback, Fragment } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DocumentTextIcon, BanknotesIcon } from '@heroicons/react/24/outline';

const START_YEAR = 2026;
const currentYear = new Date().getFullYear();
const years = Array.from({ length: currentYear - START_YEAR + 1 }, (_, i) => START_YEAR + i);

const months = [
    { id: 1, name: 'OCAK' }, { id: 2, name: 'ŞUBAT' }, { id: 3, name: 'MART' },
    { id: 4, name: 'NİSAN' }, { id: 5, name: 'MAYIS' }, { id: 6, name: 'HAZİRAN' },
    { id: 7, name: 'TEMMUZ' }, { id: 8, name: 'AĞUSTOS' }, { id: 9, name: 'EYLÜL' },
    { id: 10, name: 'EKİM' }, { id: 11, name: 'KASIM' }, { id: 12, name: 'ARALIK' }
];

function addDays(dateStr, days) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d;
}

function fmt(date) {
    return new Date(date).toLocaleDateString('tr-TR');
}

function fmtTime(date) {
    return new Date(date).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtMoney(n, showSign = false) {
    const val = Number(n || 0);
    const absVal = Math.abs(val).toLocaleString('tr-TR', { minimumFractionDigits: 2 });
    if (!showSign) return '₺' + absVal;
    
    if (val > 0) return '+₺' + absVal;
    if (val < 0) return '-₺' + absVal;
    return '₺' + absVal;
}

export default function AdminAccountLedger() {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedRow, setExpandedRow] = useState(null);
    const [orderDetails, setOrderDetails] = useState({});
    const [loadingDetails, setLoadingDetails] = useState({});
    const [dbError, setDbError] = useState(false);
    const [selectedYear, setSelectedYear] = useState(currentYear < 2026 ? 2026 : currentYear);
    const [selectedMonth, setSelectedMonth] = useState(null);
    const [totals, setTotals] = useState({ debt: 0, credit: 0 });
    
    const [showTxModal, setShowTxModal] = useState(false);
    const [txForm, setTxForm] = useState({ companyId: '', type: 'debt', amount: '', description: '', documentNo: '' });
    const [txSaving, setTxSaving] = useState(false);
    const [companies, setCompanies] = useState([]);

    const supabase = createClient();

    const fetchTransactions = useCallback(async () => {
        setLoading(true);

        let startDate, endDate;
        if (selectedMonth) {
            startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
            const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
            endDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${lastDay}T23:59:59`;
        } else {
            startDate = `${selectedYear}-01-01`;
            endDate = `${selectedYear}-12-31T23:59:59`;
        }

        const { data, error } = await supabase.from('account_transactions')
            .select('*, company:companies(name)')
            .gte('created_at', startDate)
            .lte('created_at', endDate)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Transactions fetch error:', error);
            if (error.code === '42P01') setDbError(true);
        } else {
            setTransactions(data || []);
            const tDebt = (data || []).reduce((acc, r) => acc + Number(r.debt || 0), 0);
            const tCredit = (data || []).reduce((acc, r) => acc + Number(r.credit || 0), 0);
            setTotals({ debt: tDebt, credit: tCredit });
        }
        setLoading(false);
    }, [selectedYear, selectedMonth]);

    useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

    const openTxModal = async () => {
        setShowTxModal(true);
        if (companies.length === 0) {
            const { data } = await supabase.from('companies').select('id, name').order('name');
            if (data) setCompanies(data);
        }
    };

    const handleAddTx = async (e) => {
        e.preventDefault();
        setTxSaving(true);
        try {
            const res = await fetch('/api/admin/transactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    companyId: txForm.companyId,
                    type: txForm.type,
                    amount: txForm.amount,
                    description: txForm.description,
                    documentNo: txForm.documentNo
                })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'İşlem başarısız');
            setShowTxModal(false);
            setTxForm({ companyId: '', type: 'debt', amount: '', description: '', documentNo: '' });
            fetchTransactions(); // Reload data immediately
        } catch(err) {
            alert('Hata: ' + err.message);
        }
        setTxSaving(false);
    };

    const handleExpand = async (tx) => {
        if (expandedRow === tx.id) { setExpandedRow(null); return; }
        setExpandedRow(tx.id);
        if (tx.transaction_type === 'TOPTAN SATIŞ' && tx.document_no && !orderDetails[tx.id]) {
            setLoadingDetails(prev => ({ ...prev, [tx.id]: true }));
            const { data } = await supabase.from('order_items')
                .select('*, product:products(name, code, oem_no)')
                .eq('order_id', tx.document_no);
            setOrderDetails(prev => ({ ...prev, [tx.id]: data || [] }));
            setLoadingDetails(prev => ({ ...prev, [tx.id]: false }));
        }
    };

    if (dbError) {
        return (
            <div className="page-wrapper">
                <div className="card" style={{ padding: 40, textAlign: 'center', marginTop: 40 }}>
                    <h2 style={{ color: 'var(--danger)', marginBottom: 16 }}>⚠️ Sistem Kurulumu Eksik</h2>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        Cari Hesap tabloları bulunamadı. Lütfen Supabase SQL Editor üzerinden 002_cari_hesap_migration.sql dosyasını çalıştırın.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="page-wrapper">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Genel Cari Hareketler (Admin)</h1>
                    <p className="page-subtitle">Platformdaki tüm bayilerin borç, alacak ve toplam kâr dökümleri</p>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                    <button className="btn btn-primary" onClick={openTxModal} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <BanknotesIcon style={{ width: 18, height: 18 }} /> Bakiye İşlemi (Borç/Alacak)
                    </button>
                    <button className="btn btn-ghost" onClick={() => window.print()} title="Yazdır/PDF Olarak Kaydet">
                        <DocumentTextIcon style={{ width: 18, height: 18, marginRight: 6 }} /> Tüm Ekstreyi İndir
                    </button>
                </div>
            </div>

            {/* Filter Tabs */}
            <div style={{ background: 'var(--bg-surface)', padding: 12, borderRadius: 'var(--radius)', border: '1px solid var(--border)', marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginRight: 8 }}>YIL:</span>
                    {years.map(y => (
                        <button
                            key={y}
                            onClick={() => { setSelectedYear(y); setSelectedMonth(null); setExpandedRow(null); }}
                            style={{
                                padding: '6px 16px',
                                borderRadius: 6,
                                border: '1px solid var(--border)',
                                background: selectedYear === y && !selectedMonth ? 'var(--primary)' : 'var(--bg-surface)',
                                color: selectedYear === y && !selectedMonth ? '#fff' : 'var(--text-secondary)',
                                fontWeight: 700,
                                cursor: 'pointer',
                                fontSize: 13,
                                transition: 'all 0.15s'
                            }}
                        >
                            {y}
                        </button>
                    ))}
                </div>
                
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center', borderTop: '1px solid var(--border-light)', paddingTop: 12 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginRight: 8 }}>AY:</span>
                    {months.map(m => (
                        <button
                            key={m.id}
                            onClick={() => { 
                                setSelectedMonth(selectedMonth === m.id ? null : m.id); 
                                setExpandedRow(null); 
                            }}
                            style={{
                                padding: '6px 12px',
                                borderRadius: 6,
                                border: '1px solid var(--border)',
                                background: selectedMonth === m.id ? 'var(--primary)' : 'var(--bg-tag)',
                                color: selectedMonth === m.id ? '#fff' : 'var(--text-primary)',
                                fontWeight: selectedMonth === m.id ? 700 : 500,
                                cursor: 'pointer',
                                fontSize: 12,
                                transition: 'all 0.15s'
                            }}
                        >
                            {m.name}
                        </button>
                    ))}
                </div>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="table-wrapper" style={{ border: 'none', margin: 0 }}>
                    <table style={{ margin: 0 }}>
                        <thead style={{ background: 'var(--bg-surface)' }}>
                            <tr>
                                <th style={{ width: 80, textAlign: 'center' }}>Detay</th>
                                <th>Tarih</th>
                                <th>Vade Tarih</th>
                                <th>Firma Adı</th>
                                <th>Evrak No</th>
                                <th>İşlem Türü</th>
                                <th style={{ textAlign: 'right' }}>Borç</th>
                                <th style={{ textAlign: 'right' }}>Alacak</th>
                                <th style={{ textAlign: 'right' }}>Toplam Kâr</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="9"><div className="loading-center" style={{ padding: 40 }}><div className="loading-spinner" /></div></td></tr>
                            ) : transactions.length === 0 ? (
                                <tr>
                                    <td colSpan="9" style={{ padding: 60, textAlign: 'center', color: 'var(--text-secondary)' }}>
                                        <div style={{ fontSize: 32, marginBottom: 16 }}>📊</div>
                                        <div style={{ fontSize: 16, fontWeight: 500 }}>{selectedYear} yılında cari hareket bulunmuyor</div>
                                    </td>
                                </tr>
                            ) : transactions.map(tx => {
                                const isExpanded = expandedRow === tx.id;
                                const isOrder = tx.transaction_type === 'TOPTAN SATIŞ';
                                const vadeDate = tx.due_date ? fmt(tx.due_date) : fmt(addDays(tx.created_at, 7));
                                return (
                                    <Fragment key={tx.id}>
                                        <tr style={{ background: isExpanded ? 'rgba(37,99,235,0.03)' : 'transparent', transition: 'background 0.2s', borderBottom: isExpanded ? 'none' : undefined }}>
                                            <td style={{ textAlign: 'center' }}>
                                                <button
                                                    onClick={() => handleExpand(tx)}
                                                    className="btn btn-sm"
                                                    style={{ background: isExpanded ? 'var(--primary)' : 'var(--bg-tag)', color: isExpanded ? '#fff' : 'var(--text-primary)', border: 'none', padding: '4px 12px' }}
                                                >
                                                    {isExpanded ? 'Gizle' : 'Detay'}
                                                </button>
                                            </td>
                                            <td style={{ fontWeight: 500 }}>{fmtTime(tx.created_at)}</td>
                                            <td style={{ color: 'var(--text-secondary)' }}>{vadeDate}</td>
                                            <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{tx.company?.name || '-'}</td>
                                            <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{tx.document_no ? tx.document_no.slice(0, 8).toUpperCase() : '-'}</td>
                                            <td>
                                                <span style={{
                                                    fontWeight: 600,
                                                    color: tx.transaction_type === 'KREDİ KARTI' || tx.transaction_type === 'HAVALE/EFT' ? 'var(--success)' :
                                                        tx.transaction_type === 'TOPTAN SATIŞ' ? 'var(--primary)' : 'var(--text-secondary)'
                                                }}>
                                                    {tx.transaction_type}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: tx.debt > 0 ? 600 : 400, color: tx.debt > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                                                {tx.debt > 0 ? fmtMoney(tx.debt) : '0,00'}
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: tx.credit > 0 ? 600 : 400, color: tx.credit > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
                                                {tx.credit > 0 ? fmtMoney(tx.credit) : '0,00'}
                                            </td>
                                            <td style={{ 
                                                textAlign: 'right', 
                                                fontWeight: 700, 
                                                color: (tx.balance_after || 0) < 0 ? 'var(--danger)' : (tx.balance_after > 0 ? 'var(--success)' : 'var(--text-primary)') 
                                            }}>
                                                {fmtMoney(tx.balance_after, true)}
                                            </td>
                                        </tr>
                                        {isExpanded && (
                                            <tr style={{ background: 'rgba(37,99,235,0.015)' }}>
                                                <td colSpan="9" style={{ padding: '0 24px 20px 80px', borderTop: 'none' }}>
                                                    <div style={{ background: 'var(--bg-surface)', padding: 16, borderRadius: 'var(--radius)', border: '1px solid var(--border)', marginTop: 4 }}>
                                                        <h4 style={{ fontSize: 13, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12, fontWeight: 700, letterSpacing: '0.5px' }}>
                                                            {isOrder ? `Sipariş İçeriği — ${tx.document_no?.slice(0, 8).toUpperCase()} (${tx.company?.name})` : 'İşlem Detayı'}
                                                        </h4>
                                                        {isOrder ? (
                                                            loadingDetails[tx.id] ? (
                                                                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Yükleniyor...</div>
                                                            ) : (orderDetails[tx.id] || []).length === 0 ? (
                                                                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>İçerik bulunamadı.</div>
                                                            ) : (
                                                                <table style={{ margin: 0, fontSize: 13, background: 'transparent' }}>
                                                                    <thead style={{ background: 'transparent', borderBottom: '1px solid var(--border-light)' }}>
                                                                        <tr>
                                                                            <th style={{ padding: '8px 4px', color: 'var(--text-secondary)' }}>Ürün Kodu</th>
                                                                            <th style={{ padding: '8px 4px', color: 'var(--text-secondary)' }}>Ürün Adı</th>
                                                                            <th style={{ padding: '8px 4px', color: 'var(--text-secondary)' }}>OEM No</th>
                                                                            <th style={{ padding: '8px 4px', color: 'var(--text-secondary)', textAlign: 'right' }}>Miktar</th>
                                                                            <th style={{ padding: '8px 4px', color: 'var(--text-secondary)', textAlign: 'right' }}>Birim Fiyat</th>
                                                                            <th style={{ padding: '8px 4px', color: 'var(--text-secondary)', textAlign: 'right' }}>Tutar</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {orderDetails[tx.id].map(item => (
                                                                            <tr key={item.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                                                                <td style={{ padding: '8px 4px', fontFamily: 'monospace' }}>{item.product?.code || '-'}</td>
                                                                                <td style={{ padding: '8px 4px', fontWeight: 500 }}>{item.product?.name}</td>
                                                                                <td style={{ padding: '8px 4px', fontFamily: 'monospace', color: 'var(--text-secondary)', fontSize: 12 }}>{item.product?.oem_no || '-'}</td>
                                                                                <td style={{ padding: '8px 4px', textAlign: 'right' }}>{item.quantity}</td>
                                                                                <td style={{ padding: '8px 4px', textAlign: 'right' }}>{fmtMoney(item.unit_price)}</td>
                                                                                <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 600 }}>{fmtMoney(item.total_price)}</td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            )
                                                        ) : (
                                                            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                                                                <strong>Açıklama:</strong> {tx.description || '-'}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </Fragment>
                                );
                            })}
                        </tbody>
                        {!loading && transactions.length > 0 && (
                            <tfoot style={{ background: 'var(--bg-surface)', borderTop: '2px solid var(--border)' }}>
                                <tr>
                                    <td colSpan="6" style={{ textAlign: 'right', fontWeight: 700, padding: '16px 20px' }}>PLATFORM DÖNEM TOPLAMI</td>
                                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--danger)', padding: '16px 20px', fontSize: 16 }}>
                                        {fmtMoney(totals.debt)}
                                    </td>
                                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success)', padding: '16px 20px', fontSize: 16 }}>
                                        {fmtMoney(totals.credit)}
                                    </td>
                                    <td style={{ 
                                        textAlign: 'right', 
                                        fontWeight: 700, 
                                        color: (totals.credit - totals.debt) < 0 ? 'var(--danger)' : (totals.credit - totals.debt > 0 ? 'var(--success)' : 'var(--primary)'), 
                                        padding: '16px 20px', 
                                        fontSize: 18 
                                    }}>
                                        {fmtMoney(totals.credit - totals.debt, true)}
                                    </td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>

            {/* BALANCE ADJUSTMENT MODAL */}
            {showTxModal && (
                <div className="modal-overlay" onClick={() => setShowTxModal(false)}>
                    <div className="modal" style={{ maxWidth: 450 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Bakiye İşlemi Ekle</h3>
                            <button className="modal-close" onClick={() => setShowTxModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleAddTx}>
                            <div className="form-group">
                                <label className="form-label">Firma Seçin *</label>
                                <select className="form-select" value={txForm.companyId} onChange={e => setTxForm(prev => ({ ...prev, companyId: e.target.value }))} required>
                                    <option value="">-- Firma Seçin --</option>
                                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">İşlem Türü *</label>
                                <select className="form-select" value={txForm.type} onChange={e => setTxForm(prev => ({ ...prev, type: e.target.value }))} required>
                                    <option value="debt">Borçlandır (Firma Bize Borçlanır)</option>
                                    <option value="credit">Alacaklandır / Tahsilat (Firma Tahsilatı)</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Tutar (₺) *</label>
                                <input className="form-input" type="number" step="0.01" min="0.01" value={txForm.amount} onChange={e => setTxForm(prev => ({ ...prev, amount: e.target.value }))} placeholder="Örn: 1500.50" required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Açıklama *</label>
                                <input className="form-input" type="text" value={txForm.description} onChange={e => setTxForm(prev => ({ ...prev, description: e.target.value }))} placeholder="Açıklama giriniz (EFT, Manuel Fatura vb.)" required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Evrak / İşlem No</label>
                                <input className="form-input" type="text" value={txForm.documentNo} onChange={e => setTxForm(prev => ({ ...prev, documentNo: e.target.value }))} placeholder="(İsteğe bağlı)" />
                            </div>
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
                                <button type="button" className="btn btn-ghost" onClick={() => setShowTxModal(false)}>İptal</button>
                                <button type="submit" className="btn btn-primary" disabled={txSaving}>{txSaving ? 'İşleniyor...' : 'İşlemi Kaydet'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
}
