
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    allowedDevOrigins: [
      'https://6000-firebase-studio-1747722195027.cluster-3ch54x2epbcnetrm6ivbqqebjk.cloudworkstations.dev',
      'https://6000-firebase-studio-1747722195027.cluster-3ch54x2epbcnetrm6ivbqqebjk.cloudworkstations.dev:443',
      'http://localhost:9002'
    ],
  },
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
};

export default nextConfig;
