import { Hero } from "@/components/hero";
import { HowItWorks } from "@/components/how-it-works";
import { FactorsSection } from "@/components/factors-section";
import { DataSources } from "@/components/data-sources";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <Hero />
      <HowItWorks />
      <FactorsSection />
      <DataSources />
    </div>
  );
}
