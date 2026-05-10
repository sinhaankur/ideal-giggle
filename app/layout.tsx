import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'

import './globals.css'
import { ServiceWorkerRegister } from '@/components/sw-register'

const interFont = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'EMPATHEIA -- AI Companion',
  description:
    'An empathetic AI companion that sees, listens, and understands. Runs offline with a local LLM.',
  manifest: '/manifest.webmanifest',
  applicationName: 'EMPATHEIA',
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
