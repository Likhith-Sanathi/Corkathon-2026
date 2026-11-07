// The scorer tool owns the whole viewport and scrolls internally (map + sidebar),
// unlike the marketing homepage above it, so it locks out page-level scroll here.
export default function ExploreLayout({ children }: { children: React.ReactNode }) {
  return <div className="h-dvh overflow-hidden">{children}</div>
}
