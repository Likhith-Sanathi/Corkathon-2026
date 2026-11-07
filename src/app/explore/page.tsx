import { SiteSearch } from "@/components/site-search";
import { BestSitesSearch } from "@/components/best-sites-search";
import { ExploreSidebar } from "@/components/explore-sidebar";

export default function ExplorePage() {
  return (
    <div className="flex flex-1 flex-col items-center bg-gradient-to-b from-muted/40 to-background">
      <main className="grid w-full max-w-5xl flex-1 grid-cols-1 gap-12 px-6 py-16 sm:px-10 lg:grid-cols-[1fr_280px]">
        <div className="flex flex-col gap-12">
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-2">
              <h1 className="text-3xl font-semibold tracking-tight">
                Score a site
              </h1>
              <p className="text-muted-foreground">
                Type a place to pull the evidence and see how it scores.
                Isolation, water, and power currently use a detailed local
                dataset for the Netherlands only — climate and risk cover all
                of Europe.
              </p>
            </div>

            <SiteSearch />
          </div>

          <BestSitesSearch />
        </div>

        <ExploreSidebar />
      </main>
    </div>
  );
}
