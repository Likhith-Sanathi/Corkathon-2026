import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { TooltipProvider } from "@/components/ui/tooltip"
import { themeInitScript } from "@/lib/theme-script"
import "./globals.css"

const inter = Inter({ variable: "--font-sans", subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Corkathon · Data Centre Site Scorer",
  description: "Drop a pin anywhere in the Netherlands to score it as a data centre site.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The theme script sets classes on <html> before React hydrates.
    <html lang="en" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="h-full font-sans">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  )
}
