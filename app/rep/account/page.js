'use client';
import { useState, useEffect, useCallback, Fragment } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fetchRepTransactions, fetchRepCompanies } from './actions';
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
const presetDescriptions = [
    'YapıKredi Link Pos', 'Tosla Link Pos', 'QNB Link Pos', 'İş Bankası Link Pos',
    'EnPara Pos', 'YapıKredi IBAN', 'İşBankası IBAN', 'Nakit', 'İade', 'Diğer'
];

function fmtTime(date) {
    return new Date(date).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function fmtMoney(n, showSign = false) {
    const val = Number(n || 0);
    const absVal = Math.abs(val).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (!showSign) return '₺' + absVal;
    if (val > 0) return '+₺' + absVal;
    if (val < 0) return '-₺' + absVal;
    return '₺' + absVal;
}

export default function RepAccountPage() {
    const supabase = createClient();
    const [transactions, setTransactions] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedYear, setSelectedYear] = useState(currentYear < 2026 ? 2026 : currentYear);
    const [selectedMonth, setSelectedMonth] = useState(null);
    const [totals, setTotals] = useState({ debt: 0, credit: 0 });
    const [expandedRow, setExpandedRow] = useState(null);
    const [orderDetails, setOrderDetails] = useState({});
    const [loadingDetails, setLoadingDetails] = useState({});

    const [showTxModal, setShowTxModal] = useState(false);
    const [txForm, setTxForm] = useState({ companyId: '', type: 'debt', amount: '', description: presetDescriptions[0], customDescription: '', documentNo: '' });
    const [txSaving, setTxSaving] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        const res = await fetchRepTransactions({ year: selectedYear, month: selectedMonth });
        if (res.success) {
            setTransactions(res.data);
            setTotals({
                debt: res.data.reduce((a, r) => a + Number(r.debt || 0), 0),
                credit: res.data.reduce((a, r) => a + Number(r.credit || 0), 0)
            });
        }
        setLoading(false);
    }, [selectedYear, selectedMonth]);

    useEffect(() => { fetchData(); }, [fetchData]);

    useEffect(() => {
        fetchRepCompanies().then(setCompanies);
    }, []);

    const handleExpand = async (tx) => {
        if (expandedRow === tx.id) { setExpandedRow(null); return; }
        setExpandedRow(tx.id);
        if (tx.transaction_type === 'TOPTAN SATIŞ' && !orderDetails[tx.id]) {
            setLoadingDetails(prev => ({ ...prev, [tx.id]: true }));
            const { data } = await supabase.from('order_items')
                .select('*, product:products(name, code, oem_no)')
                .eq('order_id', tx.order_id || tx.document_no);
            setOrderDetails(prev => ({ ...prev, [tx.id]: data || [] }));
            setLoadingDetails(prev => ({ ...prev, [tx.id]: false }));
        }
    };

    const handleAddTx = async (e) => {
        e.preventDefault();
        setTxSaving(true);
        try {
            const res = await fetch('/api/rep/transactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    companyId: txForm.companyId,
                    type: txForm.type,
                    amount: txForm.amount,
                    description: txForm.description === 'Diğer' ? txForm.customDescription : txForm.description,
                    documentNo: txForm.documentNo
                })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'İşlem başarısız');
            setShowTxModal(false);
            setTxForm({ companyId: '', type: 'debt', amount: '', description: presetDescriptions[0], customDescription: '', documentNo: '' });
            fetchData();
        } catch (err) {
            alert('Hata: ' + err.message);
        }
        setTxSaving(false);
    };

    return (
        <div className="page-wrapper">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Cari Hareketler</h1>
                    <p className="page-subtitle">Sorumlu olduğunuz firmaların borç ve alacak dökümleri</p>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                    <button className="btn btn-primary" onClick={() => setShowTxModal(true)}>
                        <BanknotesIcon style={{ width: 18, height: 18, marginRight: 6 }} /> Bakiye İşlemi
                    </button>
                    <button className="btn btn-ghost" onClick={() => window.print()}>
                        <DocumentTextIcon style={{ width: 18, height: 18, marginRight: 6 }} /> Yazdır
                    </button>
                </div>
            </div>

            {/* Yıl / Ay Filtresi */}
            <div style={{ background: 'var(--bg-surface)', padding: 16, borderRadius: 16, border: '1px solid var(--border)', marginBottom: 20 }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', marginRight: 12, textTransform: 'uppercase' }}>Yıl:</span>
                    {years.map(y => (
                        <button key={y} onClick={() => { setSelectedYear(y); setSelectedMonth(null); setExpandedRow(null); }} style={{ padding: '8px 20px', borderRadius: 12, border: '1px solid var(--border)', background: selectedYear === y && !selectedMonth ? 'var(--primary)' : 'transparent', color: selectedYear === y && !selectedMonth ? '#fff' : 'var(--text-secondary)', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                            {y}
                        </button>
                    ))}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', borderTop: '1px solid var(--border-light)', paddingTop: 16 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', marginRight: 12, textTransform: 'uppercase' }}>Ay:</span>
                    {months.map(m => (
                        <button key={m.id} onClick={() => { setSelectedMonth(selectedMonth === m.id ? null : m.id); setExpandedRow(null); }} style={{ padding: '6px 14px', borderRadius: 10, border: '1px solid var(--border)', background: selectedMonth === m.id ? 'var(--primary)' : 'var(--bg-tag)', color: selectedMonth === m.id ? '#fff' : 'var(--text-primary)', fontWeight: selectedMonth === m.id ? 700 : 500, cursor: 'pointer', fontSize: 12, opacity: selectedMonth && selectedMonth !== m.id ? 0.6 : 1 }}>
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
                                <th>Firma Adı</th>
                                <th>Evrak No</th>
                                <th>İşlem Türü</th>
                                <th style={{ textAlign: 'right' }}>Borç</th>
                                <th style={{ textAlign: 'right' }}>Alacak</th>
                                <th style={{ textAlign: 'right' }}>Anlık Bakiye</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="8" style={{ textAlign: 'center', padding: 40 }}>Yükleniyor...</td></tr>
                            ) : transactions.length === 0 ? (
                                <tr><td colSpan="8" style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>Bu dönemde hareket bulunamadı.</td></tr>
                            ) : transactions.map(tx => {
                                const isExpanded = expandedRow === tx.id;
                                return (
                                    <Fragment key={tx.id}>
                                        <tr style={{ background: isExpanded ? 'rgba(37,99,235,0.03)' : 'transparent' }}>
                                            <td style={{ textAlign: 'center' }}>
                                                <button onClick={() => handleExpand(tx)} className="btn btn-sm btn-ghost">{isExpanded ? 'Gizle' : 'Detay'}</button>
                                            </td>
                                            <td>{fmtTime(tx.created_at)}</td>
                                            <td style={{ fontWeight: 600 }}>{tx.company?.name}</td>
                                            <td>{tx.document_no?.toUpperCase()}</td>
                                            <td>{tx.transaction_type}</td>
                                            <td style={{ textAlign: 'right', color: 'var(--danger)' }}>{tx.debt > 0 ? fmtMoney(tx.debt) : '-'}</td>
                                            <td style={{ textAlign: 'right', color: 'var(--success)' }}>{tx.credit > 0 ? fmtMoney(tx.credit) : '-'}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 700, color: (tx.balance_after || 0) < 0 ? '#ef4444' : '#22c55e' }}>{fmtMoney(tx.balance_after, true)}</td>
                                        </tr>
                                        {isExpanded && (
                                            <tr>
                                                <td colSpan="8" style={{ padding: '8px 24px 20px 80px' }}>
                                                    <div style={{ background: 'rgba(15, 23, 42, 0.4)', padding: 20, borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)' }}>
                                                        {tx.transaction_type === 'TOPTAN SATIŞ' ? (
                                                            loadingDetails[tx.id] ? <div style={{ fontSize: 13, color: '#cbd5e1' }}>Yükleniyor...</div>
                                                            : (orderDetails[tx.id] || []).length === 0 ? <div style={{ fontSize: 13, color: '#cbd5e1' }}>İçerik bulunamadı.</div>
                                                            : (
                                                                <table style={{ margin: 0, fontSize: 13, background: 'transparent' }}>
                                                                    <thead><tr>
                                                                        <th style={{ color: '#94a3b8' }}>Ürün Kodu</th>
                                                                        <th style={{ color: '#94a3b8' }}>Ürün Adı</th>
                                                                        <th style={{ textAlign: 'right', color: '#94a3b8' }}>Miktar</th>
                                                                        <th style={{ textAlign: 'right', color: '#94a3b8' }}>Birim Fiyat</th>
                                                                        <th style={{ textAlign: 'right', color: '#94a3b8' }}>Tutar</th>
                                                                    </tr></thead>
                                                                    <tbody>
                                                                        {orderDetails[tx.id].map(item => (
                                                                            <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                                                <td style={{ color: '#cbd5e1', fontFamily: 'monospace' }}>{item.product?.code}</td>
                                                                                <td style={{ color: '#f8fafc' }}>{item.product?.name}</td>
                                                                                <td style={{ textAlign: 'right', color: '#cbd5e1' }}>{item.quantity}</td>
                                                                                <td style={{ textAlign: 'right', color: '#cbd5e1' }}>{fmtMoney(item.unit_price * 1.20)}</td>
                                                                                <td style={{ textAlign: 'right', color: '#f8fafc', fontWeight: 700 }}>{fmtMoney(item.total_price * 1.20)}</td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            )
                                                        ) : (
                                                            <div style={{ fontSize: 14, color: '#cbd5e1' }}><strong>Açıklama:</strong> {tx.description || '-'}</div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </Fragment>
                                );
                            })}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colSpan="5" style={{ textAlign: 'right', fontWeight: 700 }}>DÖNEM TOPLAMI</td>
                                <td style={{ textAlign: 'right', color: 'var(--danger)', fontWeight: 700 }}>{fmtMoney(totals.debt)}</td>
                                <td style={{ textAlign: 'right', color: 'var(--success)', fontWeight: 700 }}>{fmtMoney(totals.credit)}</td>
                                <td style={{ textAlign: 'right', fontWeight: 800, color: (totals.credit - totals.debt) < 0 ? 'var(--danger)' : 'var(--text-primary)', fontSize: 16 }}>{fmtMoney(totals.credit - totals.debt, true)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            {showTxModal && (
                <div className="modal-overlay" onClick={() => setShowTxModal(false)}>
                    <div className="modal" style={{ maxWidth: 450 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header"><h3>Bakiye İşlemi Ekle</h3><button onClick={() => setShowTxModal(false)}>✕</button></div>
                        <form onSubmit={handleAddTx}>
                            <select className="form-select" value={txForm.companyId} onChange={e => setTxForm({ ...txForm, companyId: e.target.value })} required>
                                <option value="">Firma Seçin</option>
                                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            <select className="form-select" value={txForm.type} onChange={e => setTxForm({ ...txForm, type: e.target.value })} required>
                                <option value="debt">Borçlandır</option>
                                <option value="credit">Alacaklandır</option>
                            </select>
                            <input className="form-input" type="number" step="0.01" value={txForm.amount} onChange={e => setTxForm({ ...txForm, amount: e.target.value })} placeholder="Tutar" required />
                            <select className="form-select" value={txForm.description} onChange={e => setTxForm({ ...txForm, description: e.target.value })} required>
                                {presetDescriptions.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                            {txForm.description === 'Diğer' && <input className="form-input" type="text" value={txForm.customDescription} onChange={e => setTxForm({ ...txForm, customDescription: e.target.value })} placeholder="Açıklama" required />}
                            <input className="form-input" type="text" value={txForm.documentNo} onChange={e => setTxForm({ ...txForm, documentNo: e.target.value })} placeholder="Evrak No" />
                            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 10 }} disabled={txSaving}>Kaydet</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
