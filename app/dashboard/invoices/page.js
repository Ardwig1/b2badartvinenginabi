'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function DealerInvoices() {
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);
    const [totalUnpaid, setTotalUnpaid] = useState(0);
    const [balance, setBalance] = useState(0);
    const [creditLimit, setCreditLimit] = useState(0);
    const supabase = createClient();

    const fetchInvoices = useCallback(async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        const { data: profile } = await supabase.from('profiles')
            .select('company_id, company:companies(current_balance, credit_limit)')
            .eq('id', user.id).single();

        setBalance(profile?.company?.current_balance || 0);
        setCreditLimit(profile?.company?.credit_limit || 0);
        const { data } = await supabase.from('invoices')
            .select('*, items:invoice_items(*, product:products(name))')
            .eq('company_id', profile.company_id)
            .order('created_at', { ascending: false });
        setInvoices(data || []);
        const unpaid = (data || []).filter(i => i.status !== 'paid').reduce((acc, i) => acc + Number(i.total_amount), 0);
        setTotalUnpaid(unpaid);
        setLoading(false);
    }, []);

    useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

    const statusBadge = { unpaid: 'badge-unpaid', paid: 'badge-paid', partial: 'badge-partial' };
    const statusLabel = { unpaid: 'Ödenmedi', paid: 'Ödendi', partial: 'Kısmi Ödeme' };

    return (
        <div className="page-wrapper">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Faturalarım & Cari</h1>
                    <p className="page-subtitle">Fatura geçmişi ve borç durumu</p>
                </div>
            </div>

            {/* Cari Özet */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginBottom: 24 }}>
                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, textTransform: 'uppercase' }}>Güncel Bakiye</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: balance < 0 ? 'var(--danger)' : 'var(--success)', fontFamily: 'Outfit, sans-serif' }}>
                        ₺{Math.abs(balance).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {balance < 0 ? '(Borç)' : '(Alacak)'}
                    </div>
                    <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 'auto' }} onClick={() => alert('Sanal POS entegrasyonu (Faz 4)')}>💳 Bakiye Yükle</button>
                </div>

                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, textTransform: 'uppercase' }}>Kredi Limiti (Risk)</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif' }}>
                        ₺{Number(creditLimit).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 'auto' }}>Tanımlı risk limitiniz</div>
                </div>

                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12, border: totalUnpaid > 0 ? '1px solid rgba(220,38,38,0.3)' : '1px solid var(--border)' }}>
                    <div style={{ color: totalUnpaid > 0 ? 'var(--danger)' : 'var(--text-secondary)', fontSize: 13, fontWeight: 600, textTransform: 'uppercase' }}>
                        Açık Faturalar
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: totalUnpaid > 0 ? 'var(--danger)' : 'var(--text-primary)', fontFamily: 'Outfit, sans-serif' }}>
                        ₺{totalUnpaid.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 'auto' }}>Ödenmemiş fatura toplamı</div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 380px' : '1fr', gap: 20 }}>
                <div className="table-wrapper">
                    {loading ? (
                        <div className="loading-center"><div className="loading-spinner" /></div>
                    ) : invoices.length === 0 ? (
                        <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-secondary)' }}>
                            <div style={{ fontSize: 48, marginBottom: 16 }}>🧾</div>
                            <div style={{ fontSize: 18, fontWeight: 600 }}>Fatura bulunamadı</div>
                        </div>
                    ) : (
                        <table>
                            <thead><tr><th>Fatura No</th><th>Tutar</th><th>Vade Tarihi</th><th>Durum</th><th></th></tr></thead>
                            <tbody>
                                {invoices.map(inv => (
                                    <tr key={inv.id} style={{ cursor: 'pointer', background: selected?.id === inv.id ? 'rgba(37,99,235,0.08)' : undefined }}>
                                        <td style={{ fontFamily: 'monospace', color: 'var(--primary)' }}>{inv.invoice_number}</td>
                                        <td style={{ fontWeight: 600 }}>₺{Number(inv.total_amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                                        <td style={{ color: inv.due_date && new Date(inv.due_date) < new Date() && inv.status !== 'paid' ? 'var(--danger)' : 'inherit' }}>
                                            {inv.due_date ? new Date(inv.due_date).toLocaleDateString('tr-TR') : '-'}
                                        </td>
                                        <td><span className={`badge ${statusBadge[inv.status]}`}>{statusLabel[inv.status]}</span></td>
                                        <td><button className="btn btn-ghost btn-sm" onClick={() => setSelected(inv)} id={`inv-detail-${inv.id}`}>Detay</button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {selected && (
                    <div className="card" style={{ alignSelf: 'start', position: 'sticky', top: 20 }}>
                        <div className="card-header">
                            <h3 className="card-title">Fatura Detayı</h3>
                            <button className="modal-close" onClick={() => setSelected(null)}>✕</button>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Fatura No</div>
                            <div style={{ fontFamily: 'monospace', color: 'var(--primary)', fontWeight: 600 }}>{selected.invoice_number}</div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Durum</div>
                            <span className={`badge ${statusBadge[selected.status]}`}>{statusLabel[selected.status]}</span>
                        </div>
                        <hr className="divider" />
                        {selected.items?.map(item => (
                            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-light)', fontSize: 13 }}>
                                <div>
                                    <div style={{ fontWeight: 500 }}>{item.description || item.product?.name || '-'}</div>
                                    <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{item.quantity} × ₺{Number(item.unit_price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</div>
                                </div>
                                <div style={{ fontWeight: 600 }}>₺{Number(item.total_price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</div>
                            </div>
                        ))}
                        <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius)', padding: 12, marginTop: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>
                                <span>Ara Toplam</span><span>₺{Number(selected.subtotal).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>
                                <span>KDV ({selected.tax_percent}%)</span><span>₺{Number(selected.tax_amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 18, color: 'var(--primary)' }}>
                                <span>TOPLAM</span><span>₺{Number(selected.total_amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                            </div>
                        </div>
                        {selected.note && <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text-secondary)' }}>📝 {selected.note}</div>}

                        {selected.status !== 'paid' && (
                            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 16 }} onClick={() => alert('Sanal POS ödeme ekranı (Faz 4)')}>
                                💳 Hemen Öde (₺{Number(selected.total_amount - selected.paid_amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })})
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
