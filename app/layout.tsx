import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const publicBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const publicSite = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://trainwell.win').replace(/\/$/, '');

export const metadata: Metadata = {
  metadataBase: new URL(`${publicSite}/`),
  alternates: { canonical: `${publicSite}/` },
  title: 'TrainWell — See it · Do it · Move better',
  description: 'A phone-first virtual trainer with guided workouts, private on-device pose tracking, rep counting, and live form cues.',
  applicationName: 'TrainWell / 悦练',
  manifest: `${publicBasePath}/manifest.webmanifest`,
  icons: {
    icon: `${publicBasePath}/icon.png`,
    apple: `${publicBasePath}/icon.png`,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'TrainWell / 悦练',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: 'TrainWell / 悦练 — Your next right move',
    description: 'Follow today’s workout, learn every movement, and get live camera form cues.',
    type: 'website',
    url: `${publicSite}/`,
    images: [{ url: `${publicSite}/og-trainwell.png`, width: 1730, height: 909, alt: 'TrainWell / 悦练 — Your next right move' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TrainWell / 悦练 — Your next right move',
    description: 'Guided workouts and private, on-device camera coaching.',
    images: [`${publicSite}/og-trainwell.png`],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#151715',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
