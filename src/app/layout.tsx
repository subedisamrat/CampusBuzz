import './globals.css'
import type { Metadata } from 'next'
import { Syne, Inter, Space_Mono } from 'next/font/google'
import Providers from './providers'
import { Toaster } from 'react-hot-toast'
import BannedOverlay from '@/components/BannedOverlay'
import BanLiftedOverlay from '@/components/BanLiftedOverlay'

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-syne',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const spaceMono = Space_Mono({
  subsets: ['latin'],
  variable: '--font-space-mono',
  display: 'swap',
  weight: ['400', '700'],
})

export const metadata: Metadata = {
  title: { default: 'CampusBuzz', template: '%s — CampusBuzz' },
  description: 'Campus Event Management Platform',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`overflow-x-hidden ${inter.variable} ${syne.variable} ${spaceMono.variable}`}>
      <body className="overflow-x-hidden">
        <Providers>
          <BannedOverlay />
          <BanLiftedOverlay />
          {children}
          <Toaster position="top-right" />
        </Providers>
      </body>
    </html>
  )
}
