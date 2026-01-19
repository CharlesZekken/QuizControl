import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthInitializer } from '@/components/auth/AuthInitializer'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'QuizControl - Game-Based Learning',
  description: 'Battle for knowledge! Claim territories by answering questions correctly.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthInitializer />
        {children}
      </body>
    </html>
  )
};