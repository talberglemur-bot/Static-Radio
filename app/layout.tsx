import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Figtree, JetBrains_Mono } from 'next/font/google'
import { SplashScreen, splashBootScript } from '@/components/splash-screen'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

const figtree = Figtree({ subsets: ['latin'], variable: '--font-figtree' })
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono' })

export const metadata: Metadata = {
  title: 'Direkte – Static Radio',
  description:
    'Hør direkte radio med ekte programledere, ønskelåter og livechat. Studioet styrer musikk, lydeffekter og mikrofon i sanntid.',
  generator: 'v0.app',
  manifest: '/manifest.json',
  applicationName: 'STC Radio',
  appleWebApp: {
    capable: true,
    title: 'STC Radio',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-light-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  colorScheme: 'dark',
  themeColor: '#0B152C',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="nb"
      data-scroll-behavior="smooth"
      className={`bg-background ${figtree.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: splashBootScript }} />
      </head>
      <body className="antialiased">
        <SplashScreen />
        {children}
        <Toaster position="top-center" theme="dark" />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
