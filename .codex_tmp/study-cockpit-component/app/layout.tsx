import type { Metadata, Viewport } from 'next'
import { Vazirmatn, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const vazirmatn = Vazirmatn({
  subsets: ['arabic'],
  variable: '--font-sans',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Hossein Starship — بورد اورولوژی AUA',
  description: 'کنترل مرکزی مطالعه · آمادگی آزمون بورد تخصصی اورولوژی',
  generator: 'v0.app',
}

export const viewport: Viewport = {
  themeColor: '#F4F2EC',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="fa"
      dir="rtl"
      className={`${vazirmatn.variable} ${jetbrainsMono.variable}`}
      style={{ background: 'var(--bg-root)' }}
    >
      <body className="font-sans antialiased" style={{ background: 'var(--bg-root)', color: 'var(--text-primary)' }}>
        {children}
      </body>
    </html>
  )
}
