import { FloatingChat } from "@/components/chat-panel"
import { Cta, FactorsSection, GridLines, Hero, Manifesto, MapSection, Method, Numbers, SourcesMarquee, SwissNav } from "@/components/landing/sections"
import { SmoothScroll } from "@/components/smooth-scroll"

export default function Home() {
  return (
    <SmoothScroll>
      <SwissNav />
      <GridLines />
      <main className="relative z-10 flex flex-1 flex-col overflow-x-clip">
        <Hero />
        <Manifesto />
        <MapSection />
        <FactorsSection />
        <Method />
        <Numbers />
        <SourcesMarquee />
        <Cta />
      </main>
      <FloatingChat />
    </SmoothScroll>
  )
}
