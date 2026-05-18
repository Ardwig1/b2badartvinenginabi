'use client';
import { useState, useEffect } from 'react';
import { CogIcon, CurrencyDollarIcon, CurrencyEuroIcon } from '@heroicons/react/24/outline';

export default function GlobalMarginSettings({ onMarginUpdate }) {
    const [margin, setMargin] = useState('');
    const [usdRate, setUsdRate] = useState('');
    const [isUsdActive, setIsUsdActive] = useState(false);
    const [eurRate, setEurRate] = useState('');
    const [isEurActive, setIsEurActive] = useState(false);

    const [savingMargin, setSavingMargin] = useState(false);
    const [successMargin, setSuccessMargin] = useState(false);

    const [savingUsd, setSavingUsd] = useState(false);
    const [successUsd, setSuccessUsd] = useState(false);
    
    const [savingEur, setSavingEur] = useState(false);
    const [successEur, setSuccessEur] = useState(false);

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [marginRes, usdRes] = await Promise.all([
                    fetch('/api/admin/margin'),
                    fetch('/api/admin/usd-settings')
                ]);
                const marginData = await marginRes.json();
                const usdData = await usdRes.json();

                if (marginData?.margin !== undefined) setMargin(marginData.margin);
                if (usdData?.usd_rate !== undefined) setUsdRate(usdData.usd_rate);
                if (usdData?.is_active !== undefined) setIsUsdActive(usdData.is_active);
                if (usdData?.eur_rate !== undefined) setEurRate(usdData.eur_rate);
                if (usdData?.eur_active !== undefined) setIsEurActive(usdData.eur_active);
            } catch (error) {
                console.error("Failed to load settings", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const [applyingToAll, setApplyingToAll] = useState(false);
    const [successApply, setSuccessApply] = useState(false);

    // Targeted Update States
    const [isTargeted, setIsTargeted] = useState(false);
    const [targetField, setTargetField] = useState('name');
    const [targetValue, setTargetValue] = useState('');

    const targetFields = [
        { label: "Stok Kodu", value: "code" },
        { label: "OEM No", value: "oem_no" },
        { label: "Ürün Adı", value: "name" },
        { label: "Marka", value: "brand" },
        { label: "Ürünün Alındığı Firma (GİZLİ)", value: "supplier_brand" },
        { label: "Araç Markası", value: "car_brand" },
        { label: "Araç Modeli", value: "car_model" },
        { label: "Kategori", value: "category" },
        { label: "Para Birimi", value: "currency" },
        { label: "Geliş Fiyatı", value: "cost_price" },
        { label: "Kâr Oranı (%)", value: "profit_margin" },
        { label: "İskonto Oranı (%)", value: "discount_rate" },
        { label: "Sepette İndirim (%)", value: "cart_discount_rate" },
        { label: "Birim", value: "unit" },
        { label: "Koli Adeti", value: "box_quantity" },
        { label: "İstanbul Stok", value: "stock_merkez" },
        { label: "Depo Stok", value: "stock_depo" },
        { label: "SABİT FİYATLI ÜRÜN", value: "is_fixed_price" },
        { label: "BU ÜRÜN KAMPANYALI ÜRÜNDÜR", value: "is_campaign" },
        { label: "Açıklama", value: "description" }
    ];

    const handleSaveMargin = async (applyToAll = false) => {
        try {
            if (applyToAll) {
                const msg = isTargeted 
                    ? `Seçilen özelliğe (${targetField}) ve değere (${targetValue}) uyan TÜM ürünlerin kâr marjı %${margin} olarak güncellenecektir. Emin misiniz?`
                    : "Tüm ürünlerin kâr marjı bu oranla güncellenecektir. Bu işlem geri alınamaz. Emin misiniz?";
                if (!confirm(msg)) return;
                setApplyingToAll(true);
            } else {
                setSavingMargin(true);
            }

            const res = await fetch('/api/admin/margin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    margin: margin === '' ? 0 : margin,
                    applyToAll: applyToAll,
                    isTargeted: isTargeted,
                    targetField: targetField,
                    targetValue: targetValue
                })
            });
            
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Kaydetme hatası');
            }

            const data = await res.json();

            if (applyToAll) {
                setSuccessApply(true);
                alert(`${data.updatedCount} ürün güncellendi.`);
                setTimeout(() => setSuccessApply(false), 2500);
            } else {
                setSuccessMargin(true);
                setTimeout(() => setSuccessMargin(false), 2500);
            }
            
            if (onMarginUpdate) onMarginUpdate(Number(margin === '' ? 0 : margin));
        } catch (error) {
            console.error("Margin save error:", error);
            alert("Kâr oranı kaydedilemedi: " + error.message);
        } finally {
            setSavingMargin(false);
            setApplyingToAll(false);
        }
    };

    const handleSaveUsd = async () => {
        try {
            setSavingUsd(true);

            const res = await fetch('/api/admin/usd-settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    usd_rate: usdRate === '' ? 0 : usdRate, 
                    is_active: isUsdActive,
                    currency: 'USD'
                })
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Kaydetme hatası');
            }

            setSuccessUsd(true);
            setTimeout(() => setSuccessUsd(false), 2500);
        } catch (error) {
            console.error("USD settings save error:", error);
            alert("Dolar kuru ayarları kaydedilemedi: " + error.message);
        } finally {
            setSavingUsd(false);
        }
    };

    const handleSaveEur = async () => {
        try {
            setSavingEur(true);

            const res = await fetch('/api/admin/usd-settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    eur_rate: eurRate === '' ? 0 : eurRate, 
                    eur_active: isEurActive,
                    currency: 'EUR'
                })
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Kaydetme hatası');
            }

            setSuccessEur(true);
            setTimeout(() => setSuccessEur(false), 2500);
        } catch (error) {
            console.error("EUR settings save error:", error);
            alert("Euro kuru ayarları kaydedilemedi: " + error.message);
        } finally {
            setSavingEur(false);
        }
    };

    const toggleUsdActive = () => {
        setIsUsdActive(prev => !prev);
    };

    const toggleEurActive = () => {
        setIsEurActive(prev => !prev);
    };

    if (loading) return null;

    return (
        <div style={{ marginBottom: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            {/* Kâr Oranı */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16, margin: 0, padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ background: 'var(--primary)', color: 'white', padding: 10, borderRadius: 10 }}>
                        <CogIcon style={{ width: 24, height: 24 }} />
                    </div>
                    <div>
                        <h2 className="card-title" style={{ fontSize: 16, marginBottom: 2 }}>Genel Kâr Oranı</h2>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Sistemin varsayılan kâr marjı</div>
                    </div>
                    <div style={{ flex: 1 }} />
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <span style={{ position: 'absolute', left: 12, fontSize: 16, fontWeight: 700, color: 'var(--text-muted)' }}>%</span>
                        <input
                            type="number"
                            className="form-input"
                            value={margin}
                            onChange={e => setMargin(e.target.value)}
                            style={{ width: 90, fontSize: 16, fontWeight: 700, paddingLeft: 30, paddingRight: 10, textAlign: 'center' }}
                        />
                    </div>
                    <button className={`btn ${successMargin ? 'btn-success' : 'btn-primary'} btn-sm`} onClick={() => handleSaveMargin(false)} disabled={savingMargin || applyingToAll}>
                        {savingMargin ? '...' : successMargin ? '✓' : 'Varsayılan Yap'}
                    </button>
                </div>

                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input 
                            type="checkbox" 
                            id="targeted-margin" 
                            checked={isTargeted} 
                            onChange={e => {
                                setIsTargeted(e.target.checked);
                                if (e.target.checked) setTargetField('supplier_brand');
                            }} 
                            style={{ width: 18, height: 18, cursor: 'pointer' }}
                        />
                        <label htmlFor="targeted-margin" style={{ fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Markaya/Firmaya Özel Uygula:</label>
                    </div>

                    {isTargeted && (
                        <>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Alındığı Firma:</span>
                            <input 
                                className="form-input" 
                                value={targetValue} 
                                onChange={e => setTargetValue(e.target.value)}
                                placeholder="Örn: GKL veya OEM"
                                style={{ height: 32, fontSize: 12, width: 180, fontWeight: 700 }}
                            />
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>olanlar için kâr %{margin} olsun</span>
                        </>
                    )}

                    <div style={{ flex: 1 }} />
                    
                    <button 
                        className={`btn ${successApply ? 'btn-success' : 'btn-warning'} btn-sm`} 
                        onClick={() => handleSaveMargin(true)} 
                        disabled={savingMargin || applyingToAll || (isTargeted && !targetValue)}
                        style={{ fontWeight: 700 }}
                    >
                        {applyingToAll ? 'Güncelleniyor...' : successApply ? '✓ Başarılı' : isTargeted ? 'Kuralı Kaydet ve Uygula 🚀' : 'TÜM Ürünlere Uygula ⚠️'}
                    </button>
                </div>
            </div>

            {/* Kur Sabitleme (USD & EUR) */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16, margin: 0, padding: 16 }}>
                {/* USD Satırı */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ background: 'var(--warning)', color: 'white', padding: 10, borderRadius: 10 }}>
                        <CurrencyDollarIcon style={{ width: 24, height: 24 }} />
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                            <h2 className="card-title" style={{ fontSize: 15, margin: 0 }}>Dolar (USD):</h2>
                            <span onClick={toggleUsdActive} style={{ cursor: 'pointer', fontWeight: 700, fontSize: 14, color: isUsdActive ? 'var(--success)' : 'var(--danger)', userSelect: 'none' }}>
                                {isUsdActive ? 'SABİT' : 'GÜNCEL'}
                            </span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>USD ürünler için kur</div>
                    </div>
                    <div style={{ flex: 1 }} />
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <span style={{ position: 'absolute', right: 10, fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}>TL</span>
                        <input
                            type="number"
                            className="form-input"
                            value={usdRate}
                            onChange={e => setUsdRate(e.target.value)}
                            style={{ width: 85, fontSize: 15, fontWeight: 700, paddingRight: 30, paddingLeft: 8, textAlign: 'center', height: 36 }}
                        />
                    </div>
                    <button className={`btn ${successUsd ? 'btn-success' : 'btn-primary'} btn-sm`} onClick={() => handleSaveUsd()} disabled={savingUsd}>
                        {savingUsd ? '...' : successUsd ? '✓' : 'Kaydet'}
                    </button>
                </div>

                <div style={{ borderTop: '1px solid var(--border-light)', margin: '0 -4px' }} />

                {/* EUR Satırı */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ background: '#10b981', color: 'white', padding: 10, borderRadius: 10 }}>
                        <CurrencyEuroIcon style={{ width: 24, height: 24 }} />
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                            <h2 className="card-title" style={{ fontSize: 15, margin: 0 }}>Euro (EUR):</h2>
                            <span onClick={toggleEurActive} style={{ cursor: 'pointer', fontWeight: 700, fontSize: 14, color: isEurActive ? 'var(--success)' : 'var(--danger)', userSelect: 'none' }}>
                                {isEurActive ? 'SABİT' : 'GÜNCEL'}
                            </span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>EUR ürünler için kur</div>
                    </div>
                    <div style={{ flex: 1 }} />
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <span style={{ position: 'absolute', right: 10, fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}>TL</span>
                        <input
                            type="number"
                            className="form-input"
                            value={eurRate}
                            onChange={e => setEurRate(e.target.value)}
                            style={{ width: 85, fontSize: 15, fontWeight: 700, paddingRight: 30, paddingLeft: 8, textAlign: 'center', height: 36 }}
                        />
                    </div>
                    <button className={`btn ${successEur ? 'btn-success' : 'btn-primary'} btn-sm`} onClick={() => handleSaveEur()} disabled={savingEur}>
                        {savingEur ? '...' : successEur ? '✓' : 'Kaydet'}
                    </button>
                </div>

            </div>
        </div>
    );
}
