import { ChatWidget } from "@/components/chat-widget"
import { DataSources } from "@/components/data-sources"
import { FactorsSection } from "@/components/factors-section"
import { Hero } from "@/components/hero"
import { HowItWorks } from "@/components/how-it-works"
import { Nav } from "@/components/nav"
import { SmoothScroll } from "@/components/smooth-scroll"

export default function Home() {
  return (
    <SmoothScroll>
      <Nav />
      <main className="flex flex-1 flex-col">
        <Hero />
        <HowItWorks />
        <FactorsSection />
        <DataSources />
      </main>
      <ChatWidget />
    </SmoothScroll>
  )
}
