import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'GuardeX | How It Works',
  description: 'A workflow-style GuardeX onboarding preview built with Next.js.'
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
