import Link from "next/link"
import { Radar } from "lucide-react"

export function Nav() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6 sm:px-10">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <Radar className="size-5 text-primary" />
          Corkathon
        </Link>
        <Link
          href="/explore"
          className="rounded-full bg-foreground px-4 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-85"
        >
          Explore
        </Link>
      </div>
    </header>
  )
}
