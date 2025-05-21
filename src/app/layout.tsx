
import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import localFont from 'next/font/local';
import './globals.css';
// import './fonts.css'; // Manual import no longer needed for Torus Variations
import { Toaster } from '@/components/ui/toaster';
import { AppProviders } from '@/providers/AppProviders';
import { SidebarProvider } from '@/components/ui/sidebar';
import { CONTROL_PANEL_WIDTH_STRING } from '@/lib/constants';

// For GeistSans and GeistMono, we can use them directly
// const geistSans = GeistSans; 
// const geistMono = GeistMono;

// Configure Torus Variations font using next/font/local
const torusVariations = localFont({
  src: [
    {
      path: '../../public/fonts/TorusVariations-VF.woff2', // This path expects the file at [ProjectRoot]/public/fonts/
      weight: '100 900', 
      style: 'normal',
    },
    // Add other font files (e.g., .woff) if needed for broader compatibility or specific styles/weights
    // {
    //   path: '../../public/fonts/TorusVariations-VF.woff',
    //   weight: '100 900',
    //   style: 'normal',
    // },
  ],
  variable: '--font-torus-variations', // CSS variable name
  display: 'swap', // Improves perceived loading performance
});

export const metadata: Metadata = {
  title: 'SIXR Vision',
  description: 'Audio-Reactive Visualizer with AI Features',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${GeistSans.variable} ${GeistMono.variable} ${torusVariations.variable} font-sans antialiased`}>
        <SidebarProvider style={{ "--sidebar-width": CONTROL_PANEL_WIDTH_STRING } as React.CSSProperties}>
          <AppProviders>
            {children}
            <Toaster />
          </AppProviders>
        </SidebarProvider>
      </body>
    </html>
  );
}
