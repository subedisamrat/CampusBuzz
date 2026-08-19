import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Providers from './providers'
import { Toaster } from 'react-hot-toast'
import BannedOverlay from '@/components/BannedOverlay'
import BanLiftedOverlay from '@/components/BanLiftedOverlay'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
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
    <html lang="en" className={inter.variable}>
      <body>
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
