import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Canaan Baptist Church - Accounting System',
  description: 'Church Accounting System',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
