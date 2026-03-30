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
        hostname: 'fjkasgelauwnsfoqecov.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default nextConfig;
