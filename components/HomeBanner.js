'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';

export default function HomeBanner() {
    const [banners, setBanners] = useState(['/banner1.jpg', '/banner2.jpg', '/banner3.jpg']);
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        const fetchBanners = async () => {
            const supabase = createClient();
            
            // 1. Fetch custom banners - order by display_order
            const { data, error } = await supabase
                .from('banners')
                .select('image_url')
                .eq('is_active', true)
                .order('display_order', { ascending: true });
            
            // 2. Fetch hidden defaults
            const { data: hiddenData } = await supabase
                .from('price_groups')
                .select('name')
                .eq('discount_percent', -999);
            
            const hiddenIds = hiddenData ? hiddenData.map(d => d.name.replace('HIDDEN_BANNER_', '')) : [];

            if (!error && data && data.length > 0) {
                setBanners(data.map(b => b.image_url));
            } else {
                // Filter the default set
                const defaults = ['/banner1.jpg', '/banner2.jpg', '/banner3.jpg'];
                const filtered = defaults.filter((_, i) => !hiddenIds.includes(`def${i + 1}`));
                if (filtered.length > 0) setBanners(filtered);
                else setBanners([]); // No banners at all
            }
        };
        fetchBanners();
    }, []);

    useEffect(() => {
        if (banners.length <= 1) return;
        const timer = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % banners.length);
        }, 4000); // 4 seconds

        return () => clearInterval(timer);
    }, [banners.length]);

    return (
        <div style={{ marginBottom: 20 }}>
            <div style={{ 
                position: 'relative', 
                width: '100%', 
                borderRadius: 'var(--radius-lg)', 
                overflow: 'hidden', 
                minHeight: 120, 
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
                        <div key={src} style={{ minWidth: '100%', position: 'relative' }}>
                            <Image
                                src={src}
                                alt={`Banner ${i + 1}`}
                                width={1200}
                                height={300}
                                style={{ width: '100%', height: 'auto', display: 'block', objectFit: 'cover' }}
                                priority={i === 0}
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
