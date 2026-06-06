import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PGF Nutrição',
  description: 'Plataforma de nutrição e treino — Pedro Garrastazu Frey',
  icons: { icon: '/favicon.ico' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
