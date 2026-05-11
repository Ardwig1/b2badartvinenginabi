'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function DealerInvoices() {
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchInvoices = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/user/invoices');
            if (res.ok) {
                const data = await res.json();
                setInvoices(data || []);
            }
        } catch (err) {
            console.error('Fetch invoices error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

    const fmtMoney = (n) => n > 0 ? '₺' + Number(n).toLocaleString('tr-TR', { minimumFractionDigits: 2 }) : '-';

    return (
        <div className="page-wrapper">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Faturalarım</h1>
                    <p className="page-subtitle">Sisteme yüklenen tüm fatura veya dekontlarınız</p>
                </div>
            </div>

            <div className="table-wrapper">
                {loading ? (
                    <div className="loading-center"><div className="loading-spinner" /></div>
                ) : invoices.length === 0 ? (
                    <div className="empty-state" style={{ padding: 60 }}>
                        <div style={{ fontSize: 48, marginBottom: 16 }}>🧾</div>
                        <div className="empty-state-title">Fatura bulunamadı</div>
                    </div>
                ) : (
                    <table>
                        <thead>
                            <tr>
                                <th>Tarih</th>
                                <th>Açıklama</th>
                                <th>OEM No</th>
                                <th style={{ textAlign: 'right' }}>Tutar</th>
                                <th style={{ textAlign: 'right' }}>İşlem</th>
                            </tr>
                        </thead>
                        <tbody>
                            {invoices.map(inv => {
                                let noteData = { desc: '', url: '' };
                                try { noteData = JSON.parse(inv.note || '{}'); } catch (e) { noteData = { desc: inv.note, url: '' }; }
                                return (
                                    <tr key={inv.id}>
                                        <td data-label="Tarih" style={{ fontWeight: 600 }}>{inv.due_date ? new Date(inv.due_date).toLocaleDateString('tr-TR') : '-'}</td>
                                        <td data-label="Açıklama">{noteData.desc || '-'}</td>
                                        <td data-label="OEM No">
                                            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{inv.oem_nos || '-'}</span>
                                        </td>
                                        <td data-label="Tutar" style={{ textAlign: 'right', fontWeight: 600, color: inv.total_amount > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>{fmtMoney(inv.total_amount)}</td>
                                        <td data-label="İşlem" style={{ textAlign: 'right' }}>
                                            {noteData.url ? (
                                                <a href={`/api/file?url=${encodeURIComponent(noteData.url)}`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm" style={{ color: '#2563eb', fontWeight: 700, borderColor: '#2563eb' }}>📄 PDF İndir</a>
                                            ) : (
                                                <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Dosya Yok</span>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
