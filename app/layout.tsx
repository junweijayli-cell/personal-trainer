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

export const metadata: Metadata = {
  metadataBase: new URL('https://relay-coach-jay.junwei-jay-li.chatgpt.site'),
  title: 'Relay Coach — See it. Do it. Move better.',
  description: 'A phone-first virtual trainer with guided workouts, private on-device pose tracking, rep counting, and live form cues.',
  applicationName: 'Relay Coach',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icon.png',
    apple: '/icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Relay',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: 'Relay Coach — Your next right move',
    description: 'Follow today’s workout, learn every movement, and get live camera form cues.',
    type: 'website',
    images: [{ url: '/og.png', width: 1730, height: 909, alt: 'Relay — Your next right move' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Relay Coach — Your next right move',
    description: 'Guided workouts and private, on-device camera coaching.',
    images: ['/og.png'],
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
