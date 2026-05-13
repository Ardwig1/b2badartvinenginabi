/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true, // Vercel resim optimizasyonunu kapatıyoruz ki kotadan yemesin
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.omigroups.com',
        port: '',
        pathname: '/**', 
      },
      {
        protocol: 'https',
        hostname: 'pub-56f4ab060d934f85a7d1fec80dd03ee2.r2.dev',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'xpziispstwarngpsmstd.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default nextConfig; // Vercel deploy test (CLI hatasiz)
