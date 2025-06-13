
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true, // Relax ESLint for builds
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  allowedDevOrigins: [
    'https://6000-firebase-studio-1747722195027.cluster-3ch54x2epbcnetrm6ivbqqebjk.cloudworkstations.dev',
    'http://localhost:9002' // Uncommented for local development
  ],
};

export default nextConfig;
