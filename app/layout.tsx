import type { Metadata, Viewport } from 'next'
import { Space_Mono, Inter } from 'next/font/google'

import './globals.css'

const spaceMono = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-space-mono',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'EMPATHEIA -- AI Companion',
  description: 'An empathetic AI companion that sees, listens, and understands.',
}

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${spaceMono.variable} ${inter.variable}`}>
      <body className="font-mono antialiased">{children}</body>
    </html>
  )
}
