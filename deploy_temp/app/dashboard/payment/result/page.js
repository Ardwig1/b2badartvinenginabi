'use client';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';

export default function PaymentResultPage() {
    const searchParams = useSearchParams();
    const status = searchParams.get('status');
    const message = searchParams.get('message');
    const orderId = searchParams.get('orderId');
    const isShowroom = searchParams.get('showroom') === 'true';

    const [isClient, setIsClient] = useState(false);
    const [hasPendingCart, setHasPendingCart] = useState(false);

    useEffect(() => {
        setIsClient(true);
        if (sessionStorage.getItem('pendingCartTotal')) {
            setHasPendingCart(true);
        }
    }, []);

    if (!isClient) return null;

    const isSuccess = status === 'success';
    const showroomQuery = isShowroom ? '&showroom=true' : '';
    const showroomQueryStart = isShowroom ? '?showroom=true' : '';

    return (
        <div className="page-wrapper">
            <div className="card" style={{ maxWidth: 500, margin: '40px auto', padding: 40, textAlign: 'center' }}>
                {isSuccess ? (
                    <>
                        <CheckCircleIcon style={{ width: 80, height: 80, color: '#10b981', margin: '0 auto 20px' }} />
                        <h2 style={{ fontSize: 24, marginBottom: 10, color: 'var(--text-primary)' }}>Ödeme Başarılı!</h2>
                        
                        {hasPendingCart ? (
                            <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: 20, borderRadius: 12, marginBottom: 20 }}>
                                <p style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 8, fontSize: 16 }}>
                                    Bakiyeniz başarıyla güncellendi!
                                </p>
                                <p style={{ color: 'var(--text-secondary)', fontSize: 15 }}>
                                    Sepetinizdeki siparişi tamamlamak için <strong style={{color: '#10b981'}}>lütfen sepetinize dönerek onay verin.</strong> Siparişiniz henüz oluşturulmadı.
                                </p>
                            </div>
                        ) : (
                            <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>
                                İşleminiz başarıyla gerçekleştirildi. Bizi tercih ettiğiniz için teşekkür ederiz.
                            </p>
                        )}
                        
                        {orderId && (
                            <div style={{ background: 'rgba(255,255,255,0.05)', padding: 10, borderRadius: 8, marginBottom: 20 }}>
                                <span style={{ color: 'var(--text-muted)' }}>İşlem Referans No: </span>
                                <strong>{orderId}</strong>
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        <XCircleIcon style={{ width: 80, height: 80, color: '#ef4444', margin: '0 auto 20px' }} />
                        <h2 style={{ fontSize: 24, marginBottom: 10, color: 'var(--text-primary)' }}>Ödeme Başarısız</h2>
                        <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>
                            İşleminiz sırasında bir hata oluştu: 
                            <br/>
                            <strong style={{ color: '#ef4444', marginTop: 10, display: 'block' }}>
                                {message ? decodeURIComponent(message).replace(/_/g, ' ') : 'Bilinmeyen Hata'}
                            </strong>
                        </p>
                    </>
                )}

                <div style={{ marginTop: 30, display: 'flex', gap: 15, justifyContent: 'center' }}>
                    {!isSuccess ? (
                        <>
                            <Link href={`/dashboard/payment${showroomQueryStart}`} className="btn btn-outline">
                                Tekrar Dene
                            </Link>
                            <Link href={`/dashboard${showroomQueryStart}`} className="btn btn-primary">
                                Panele Dön
                            </Link>
                        </>
                    ) : (
                        hasPendingCart ? (
                            <Link href={`/dashboard/cart?autoSubmit=true${showroomQuery}`} className="btn btn-primary" style={{ padding: '12px 24px', fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                                Sepetime Git ve Siparişi Tamamla
                            </Link>
                        ) : (
                            <Link href={`/dashboard${showroomQueryStart}`} className="btn btn-primary">
                                Panele Dön
                            </Link>
                        )
                    )}
                </div>
            </div>
        </div>
    );
}
