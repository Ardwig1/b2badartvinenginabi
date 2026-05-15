'use client';

export default function Logo({ type = 'auto', color = '#fff' }) {
    const isTech = type === 'tech';

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            {/* Project Logo Image (Sidebar version as requested) */}
            <div style={{ flexShrink: 0 }}>
                <img 
                    src="/artpar-logo-sidebar.png" 
                    alt="ARTPAR Logo" 
                    style={{ width: '45px', height: '45px', objectFit: 'contain' }} 
                />
            </div>

            {/* Vertical Divider Line */}
            <div style={{ position: 'relative', width: '2px', height: '45px', background: isTech ? 'transparent' : color }}>
                {isTech && (
                    <div style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                        {/* Motherboard Line - vertical core */}
                        <div style={{ width: '2px', height: '100%', background: color }} />
                        
                        {/* Branches */}
                        <div style={{ position: 'absolute', top: '10%', left: '2px', width: '12px', height: '2px', background: color }} />
                        <div style={{ position: 'absolute', top: '10%', left: '14px', width: '4px', height: '4px', borderRadius: '50%', background: color, transform: 'translateY(-1px)' }} />

                        <div style={{ position: 'absolute', top: '40%', left: '2px', width: '8px', height: '2px', background: color }} />
                        <div style={{ position: 'absolute', top: '40%', left: '10px', width: '3px', height: '3px', borderRadius: '50%', background: color, transform: 'translateY(-0.5px)' }} />

                        <div style={{ position: 'absolute', top: '70%', left: '2px', width: '15px', height: '2px', background: color }} />
                        <div style={{ position: 'absolute', top: '70%', left: '17px', width: '5px', height: '5px', borderRadius: '50%', background: color, transform: 'translateY(-1.5px)' }} />
                    </div>
                )}
            </div>

            {/* Brand Text */}
            <div style={{ display: 'flex', flexDirection: 'column', color: color }}>
                <span style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '1px', lineHeight: 1 }}>ARTPAR</span>
                <span style={{ fontSize: '9px', fontWeight: 600, marginTop: '4px', maxWidth: '200px', opacity: 0.9 }}>
                    {isTech ? 'BİLİŞİM HİZMETLERİ' : 'ARTPAR OTOMOTİV YEDEK PARÇA VE KESİCİ TAKIMLAR İTH. İHR.'}
                </span>
            </div>
        </div>
    );
}
