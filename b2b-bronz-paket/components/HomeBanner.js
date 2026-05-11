'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';

export default function HomeBanner() {
    const [banners, setBanners] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchBanners = async () => {
            try {
                const supabase = createClient();
                
                // 1. Fetch custom banners - order by display_order
                const { data, error } = await supabase
                    .from('banners')
                    .select('image_url')
                    .eq('is_active', true)
                    .order('display_order', { ascending: true });
                
                console.log('Banner Fetch Result:', { data, error });

                // 2. Fetch hidden defaults
                const { data: hiddenData, error: hiddenError } = await supabase
                    .from('price_groups')
                    .select('name')
                    .eq('discount_percent', -999);
                
                console.log('Hidden Data Result:', { hiddenData, hiddenError });
                
                const hiddenIds = hiddenData ? hiddenData.map(d => d.name.replace('HIDDEN_BANNER_', '')) : [];

                if (!error && data && data.length > 0) {
                    const mappedBanners = data.map(b => b.image_url.trim());
                    setBanners(mappedBanners);
                } else {
                    // Filter the default set
                    const defaults = ['/banner1.jpg', '/banner2.jpg', '/banner3.jpg'];
                    const filtered = defaults.filter((_, i) => !hiddenIds.includes(`def${i + 1}`));
                    setBanners(filtered);
                }
            } catch (err) {
                console.error('Banner fetch error:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchBanners();
    }, []);

    useEffect(() => {
        if (banners.length <= 1) return;
        const timer = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % banners.length);
        }, 5000); // 5 seconds for better viewing

        return () => clearInterval(timer);
    }, [banners.length]);

    if (loading) return <div style={{ width: '100%', aspectRatio: '1200/300', background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', marginBottom: 20 }}></div>;
    if (banners.length === 0) return null;

    return (
        <div style={{ marginBottom: 20 }}>
            <div style={{ 
                position: 'relative', 
                width: '100%', 
                borderRadius: 'var(--radius-lg)', 
                overflow: 'hidden', 
                background: 'var(--bg-surface)',
                aspectRatio: '1200 / 300'
            }}>
                <div style={{
                    display: 'flex',
                    transition: 'transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                    transform: `translateX(-${currentIndex * 100}%)`,
                    width: '100%',
                    height: '100%'
                }}>
                    {banners.map((src, i) => (
                        <div key={`${src}-${i}`} style={{ minWidth: '100%', position: 'relative' }}>
                            <Image
                                src={src}
                                alt={`Banner ${i + 1}`}
                                width={1200}
                                height={300}
                                style={{ width: '100%', height: 'auto', display: 'block', objectFit: 'cover' }}
                                priority={i === 0}
                                unoptimized={true}
                            />
                        </div>
                    ))}
                </div>
                
                {/* Dots Indicator */}
                <div style={{
                    position: 'absolute',
                    bottom: 12,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    display: 'flex',
                    gap: 8,
                    zIndex: 10
                }}>
                    {banners.map((_, i) => (
                        <div
                            key={i}
                            style={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                background: currentIndex === i ? 'var(--primary)' : 'rgba(255,255,255,0.5)',
                                transition: 'all 0.3s'
                            }}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
