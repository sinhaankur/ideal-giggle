import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'

import './globals.css'
import { ServiceWorkerRegister } from '@/components/sw-register'

const interFont = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
})

// Public site URL. Override per-deploy with NEXT_PUBLIC_SITE_URL if needed
// (e.g. a preview), otherwise default to the production custom domain so
// canonical/OG/sitemap URLs are absolute and crawlable.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://empatheia.sinhaankur.com'

const description =
  'A free, private AI companion for your feelings. Talk things through with an empathetic listener that runs entirely in your browser — no sign-up, no install, and your conversation never leaves your device. Not a substitute for professional or crisis care.'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'EMPATHEIA — Free Private AI Companion to Talk Through Your Feelings',
    template: '%s · EMPATHEIA',
  },
  description,
  applicationName: 'EMPATHEIA',
  manifest: '/manifest.webmanifest',
  keywords: [
    'free AI companion',
    'private mental wellness',
    'talk to an AI about feelings',
    'anonymous emotional support',
    'empathetic AI chat',
    'in-browser AI, no sign up',
    'offline AI companion',
  ],
  authors: [{ name: 'Ankur Sinha' }],
  creator: 'Ankur Sinha',
  alternates: {
    canonical: '/',
  },
  // Google Search Console ownership verification. Set the token via
  // NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION (Vercel env) — when present it renders
  // the <meta name="google-site-verification"> tag Search Console looks for.
  ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { verification: { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION } }
    : {}),
  // The app is genuinely useful and safe to surface; allow indexing and rich
  // previews. Individual non-content routes can still opt out locally.
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    siteName: 'EMPATHEIA',
    url: siteUrl,
    title: 'EMPATHEIA — Free Private AI Companion',
    description,
    images: [{ url: '/icon-512.png', width: 512, height: 512, alt: 'EMPATHEIA' }],
  },
  twitter: {
    card: 'summary',
    title: 'EMPATHEIA — Free Private AI Companion',
    description,
    images: ['/icon-512.png'],
  },
  appleWebApp: {
    capable: true,
    title: 'EMPATHEIA',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
  formatDetection: {
    telephone: false,
  },
}

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={interFont.variable}>
      <body className="font-sans antialiased">
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  )
}
