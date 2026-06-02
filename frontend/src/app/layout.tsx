import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Internet Backbone & IXP Map — Real Rails',
  description:
    'Production-style intelligence dashboard for internet infrastructure: IXPs, ASNs, submarine cables, and path concentration.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        />
      </head>

      <body className="bg-rr-bg text-rr-text antialiased">
        {children}
      </body>
    </html>
  )
}