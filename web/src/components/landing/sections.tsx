"use client"

import Link from "next/link"
import { useLayoutEffect, useRef, useState } from "react"
import { motion, useMotionValueEvent, useScroll, useSpring, useTransform } from "motion/react"
import { ArrowRight, ArrowUpRight } from "lucide-react"
import { SnowToggle } from "@/components/snowfall"
import { NL_PATH, NL_QUAKES, NL_SUBSTATIONS, NL_TELECOM, NL_VIEWBOX } from "@/lib/landing-geo"
import { cn } from "@/lib/utils"
import { CountUp, EASE, MaskLine, Rise, Rule, ScrollWords, VelocityMarquee } from "./primitives"

/* ------------------------------------------------------------------ nav */

export function SwissNav() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 200, damping: 40 })
  return (
    <header className="fixed inset-x-0 top-0 z-50 bg-background/85 backdrop-blur-md">
      <div className="grid h-14 grid-cols-12 items-center gap-4 border-b border-foreground px-4 sm:px-8">
        <Link href="/" className="col-span-6 flex items-center gap-2 text-sm font-bold tracking-tight uppercase sm:col-span-3">
          <span aria-hidden className="flex h-3 w-4 flex-col"><span className="flex-1 bg-swiss-red" /><span className="flex-1 bg-background ring-1 ring-foreground/10" /><span className="flex-1 bg-swiss-blue" /></span>
          Corkathon
        </Link>
        <nav className="col-span-6 hidden gap-6 text-xs font-medium tracking-wide uppercase sm:flex">
          {[
            ["01", "Map", "#map"],
            ["02", "Factors", "#factors"],
            ["03", "Method", "#method"],
            ["04", "Data", "#data"],
          ].map(([n, label, href]) => (
            <a key={href} href={href} className="group flex gap-1.5 hover:text-swiss-blue">
              <span className="text-muted-foreground group-hover:text-swiss-blue">{n}</span>
              {label}
            </a>
          ))}
        </nav>
        <div className="col-span-6 flex items-center justify-end gap-2 sm:col-span-3">
          <SnowToggle />
          <Link
            href="/explore"
            className="group flex h-8 items-center gap-1.5 bg-foreground px-3 text-xs font-bold tracking-wide text-background uppercase transition-colors hover:bg-swiss-red hover:text-white"
          >
            Explore
            <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        </div>
      </div>
      <motion.div className="h-0.5 origin-left bg-[linear-gradient(to_right,var(--swiss-red),var(--swiss-blue))]" style={{ scaleX }} />
    </header>
  )
}

/* ------------------------------------------------------------------ background grid */

export function GridLines() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 grid grid-cols-4 gap-4 px-4 sm:grid-cols-12 sm:px-8">
      {Array.from({ length: 12 }, (_, i) => (
        <motion.div
          key={i}
          className={cn("origin-top border-x border-foreground/[0.05]", i >= 4 && "hidden sm:block")}
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ duration: 1.6, delay: 0.04 * i, ease: EASE }}
        />
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ hero */

const HERO_LINES = [
  { text: "Where", dir: -1 },
  { text: "to build", dir: 1 },
  { text: "the next", dir: -1 },
  { text: "data centre.", dir: 1 },
]

export function Hero() {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] })
  const squareRotate = useTransform(scrollYProgress, [0, 1], [0, 90])
  const squareScale = useTransform(scrollYProgress, [0, 0.8], [1, 9])
  const metaOpacity = useTransform(scrollYProgress, [0, 0.3], [1, 0])
  const blueRotate = useTransform(scrollYProgress, [0, 1], [0, -135])
  const blueY = useTransform(scrollYProgress, [0, 1], ["0vh", "60vh"])
  const fade = useTransform(scrollYProgress, [0.55, 0.85], [1, 0])

  return (
    <section ref={ref} className="relative h-[200vh]">
      <div className="sticky top-0 flex h-dvh flex-col justify-end overflow-hidden px-4 pt-20 pb-6 sm:px-8 sm:pb-10">
        <motion.div
          aria-hidden
          className="absolute top-[34%] right-[18%] size-10 bg-swiss-blue sm:size-16"
          style={{ rotate: blueRotate, y: blueY }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1, delay: 0.75, ease: EASE }}
        />
        <motion.div
          aria-hidden
          className="absolute top-[22%] right-[8%] size-16 bg-swiss-red sm:size-28"
          style={{ rotate: squareRotate, scale: squareScale }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1, delay: 0.6, ease: EASE }}
        />

        <motion.div style={{ opacity: metaOpacity }} className="relative mb-auto grid grid-cols-12 gap-4 pt-6 text-xs font-medium tracking-wide uppercase">
          <MaskLine delay={0.2} className="col-span-6 sm:col-span-3">
            Corkathon 2026 <br /> Site intelligence
          </MaskLine>
          <MaskLine delay={0.3} className="col-span-6 sm:col-span-3">
            The Netherlands <br /> 52.13° N, 5.29° E
          </MaskLine>
          <MaskLine delay={0.4} className="col-span-6 hidden sm:col-span-3 sm:block">
            Power / Isolation / Telecom <br /> Water / Roads / Risk
          </MaskLine>
        </motion.div>

        <motion.h1 style={{ opacity: fade }} className="relative text-[min(15.5vw,13dvh)] leading-[0.86] font-bold tracking-[-0.06em] sm:text-[min(11.5vw,16.5dvh)]">
          {HERO_LINES.map((line, i) => (
            <HeroLine key={line.text} progress={scrollYProgress} dir={line.dir} delay={0.1 + i * 0.09} red={i === 3}>
              {line.text}
            </HeroLine>
          ))}
        </motion.h1>

        <motion.div style={{ opacity: metaOpacity }} className="relative mt-8 grid grid-cols-12 items-end gap-4">
          <Rise delay={0.9} className="col-span-12 sm:col-span-5">
            <p className="max-w-md text-base leading-snug sm:text-lg">
              Drop a pin anywhere in the Netherlands. We pull the public evidence and score the site, factor by factor, so the
              decision rests on data.
            </p>
          </Rise>
          <Rise delay={1} className="col-span-12 flex items-center gap-3 text-xs font-medium tracking-wide uppercase sm:col-span-4 sm:col-start-9 sm:justify-end">
            <motion.span animate={{ y: [0, 6, 0] }} transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}>
              ↓
            </motion.span>
            Scroll to read the method
          </Rise>
        </motion.div>
      </div>
    </section>
  )
}

function HeroLine({
  children,
  progress,
  dir,
  delay,
  red,
}: {
  children: string
  progress: ReturnType<typeof useScroll>["scrollYProgress"]
  dir: number
  delay: number
  red?: boolean
}) {
  const x = useTransform(progress, [0, 1], ["0%", `${dir * 28}%`])
  return (
    <motion.span style={{ x }} className="block">
      <MaskLine delay={delay} className={cn(red && "text-swiss-red")}>
        {children}
      </MaskLine>
    </motion.span>
  )
}

/* ------------------------------------------------------------------ manifesto */

export function Manifesto() {
  return (
    <section className="relative grid grid-cols-12 gap-4 px-4 py-32 sm:px-8 sm:py-48">
      <div className="col-span-12 mb-8 text-xs font-medium tracking-wide uppercase sm:col-span-3 sm:mb-0">
        <span className="text-swiss-blue">●</span> The problem
      </div>
      <ScrollWords
        className="col-span-12 text-3xl leading-[1.08] font-semibold tracking-tight sm:col-span-9 sm:text-6xl"
        text="Data centre sites are still picked on *gut *feel and a few phone calls. A good site needs *power, ~fibre, ~water and *access, away from people, out of the *flood zone and off the *fault line. We check all of it, show where every number comes from, and say plainly when the data is thin."
      />
    </section>
  )
}

/* ------------------------------------------------------------------ map (pinned) */

const MAP_STEPS = [
  { n: "01", title: "The territory", body: "About 33,500 km² of land, from the Wadden coast to the hills of Limburg." },
  { n: "02", title: "The grid", body: "Every substation from 110 kV up. The 380 kV backbone, marked in red, earns the biggest bonus." },
  { n: "03", title: "The connections", body: "Telecom exchanges and existing data centres. Fibre follows the clusters." },
  { n: "04", title: "The risk", body: "Recorded earthquakes since 2000. Groningen gas-field quakes discount nearby sites." },
]

const SUBS_SORTED = [...NL_SUBSTATIONS].sort((a, b) => a[0] - b[0])

export function MapSection() {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] })
  const [step, setStep] = useState(0)
  useMotionValueEvent(scrollYProgress, "change", (v) => setStep(Math.min(3, Math.max(0, Math.floor(v * 4.2 - 0.1)))))

  const draw = useTransform(scrollYProgress, [0, 0.22], [0, 1])
  const fill = useTransform(scrollYProgress, [0.15, 0.3], [0, 1])
  const sweep = useTransform(scrollYProgress, [0.25, 0.48], [0, 1])
  const telecom = useTransform(scrollYProgress, [0.5, 0.62], [0, 1])
  const quakes = useTransform(scrollYProgress, [0.72, 0.84], [0, 1])
  const quakeScale = useTransform(scrollYProgress, [0.72, 0.9], [0, 1])
  const mapScale = useTransform(scrollYProgress, [0, 0.25, 1], [0.85, 1, 1.06])
  const subCount = useTransform(sweep, (v) => Math.round(v * NL_SUBSTATIONS.length).toLocaleString("en-GB"))
  const telCount = useTransform(telecom, (v) => Math.round(v * NL_TELECOM.length).toLocaleString("en-GB"))
  const quakeCount = useTransform(quakes, (v) => Math.round(v * NL_QUAKES.length).toLocaleString("en-GB"))

  return (
    <section id="map" ref={ref} className="relative h-[500vh] border-t border-foreground">
      <div className="sticky top-0 grid h-dvh grid-cols-12 gap-4 overflow-hidden px-4 pt-20 pb-6 sm:px-8">
        <div className="col-span-12 flex flex-col sm:col-span-4">
          <div className="text-xs font-medium tracking-wide uppercase">
            <span className="text-swiss-red">01</span> — The map
          </div>
          <div className="relative mt-6 h-40 sm:mt-auto sm:h-56">
            {MAP_STEPS.map((s, i) => (
              <motion.div
                key={s.n}
                className="absolute inset-0"
                initial={false}
                animate={{ opacity: step === i ? 1 : 0, y: step === i ? 0 : step > i ? -30 : 30 }}
                transition={{ duration: 0.6, ease: EASE }}
              >
                <div className={cn("text-6xl font-bold tracking-tighter sm:text-8xl", i % 2 ? "text-swiss-blue" : "text-swiss-red")}>{s.n}</div>
                <div className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{s.title}</div>
                <p className="mt-2 max-w-xs text-sm leading-snug text-muted-foreground">{s.body}</p>
              </motion.div>
            ))}
          </div>
          <dl className="mt-6 hidden grid-cols-3 gap-4 border-t border-foreground pt-4 sm:grid">
            {[
              ["Substations", subCount],
              ["Exchanges", telCount],
              ["Quakes", quakeCount],
            ].map(([label, mv]) => (
              <div key={label as string}>
                <dt className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">{label as string}</dt>
                <motion.dd className="text-2xl font-bold tracking-tight tabular-nums">{mv as typeof subCount}</motion.dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 hidden h-1 w-full bg-foreground/10 sm:block">
            <motion.div className="h-full origin-left bg-swiss-blue" style={{ scaleX: scrollYProgress }} />
          </div>
        </div>

        <div className="relative col-span-12 flex min-h-0 items-center justify-center sm:col-span-8">
          <motion.svg
            viewBox={`0 0 ${NL_VIEWBOX.w} ${NL_VIEWBOX.h}`}
            className="h-full max-h-[calc(100dvh-7rem)] w-auto max-w-full"
            style={{ scale: mapScale }}
            role="img"
            aria-label="Map of the Netherlands with substations, telecom exchanges and recorded earthquakes"
          >
            <defs>
              <clipPath id="sweep">
                <motion.rect x="0" y="0" width={NL_VIEWBOX.w} height={NL_VIEWBOX.h} style={{ scaleX: sweep, originX: 0, transformBox: "fill-box" }} />
              </clipPath>
            </defs>
            <motion.path d={NL_PATH} className="fill-foreground/[0.04]" style={{ opacity: fill }} />
            <motion.path
              d={NL_PATH}
              fill="none"
              className="stroke-foreground"
              strokeWidth={2.5}
              strokeLinejoin="round"
              style={{ pathLength: draw }}
            />
            <g clipPath="url(#sweep)">
              {SUBS_SORTED.map(([x, y, big], i) =>
                big ? (
                  <rect key={i} x={x - 7} y={y - 7} width={14} height={14} className="fill-swiss-red" />
                ) : (
                  <circle key={i} cx={x} cy={y} r={3.2} className="fill-foreground" />
                ),
              )}
            </g>
            <motion.g style={{ opacity: telecom }}>
              {NL_TELECOM.map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r={5.5} fill="none" className="stroke-swiss-blue" strokeWidth={2} />
              ))}
            </motion.g>
            <motion.g style={{ opacity: quakes }}>
              {NL_QUAKES.map(([x, y, mag], i) => (
                <motion.circle
                  key={i}
                  cx={x}
                  cy={y}
                  r={Math.max(4, mag * 9)}
                  className="fill-swiss-red/15 stroke-swiss-red"
                  strokeWidth={1.5}
                  style={{ scale: quakeScale, transformBox: "fill-box", originX: 0.5, originY: 0.5 }}
                />
              ))}
            </motion.g>
          </motion.svg>

          <div className="absolute top-0 right-0 hidden flex-col gap-1.5 sm:flex text-[10px] font-medium tracking-wide uppercase">
            <Legend shape="square" label="380 kV substation" />
            <Legend shape="dot" label="110–220 kV substation" />
            <Legend shape="ring" label="Telecom exchange" />
            <Legend shape="quake" label="Earthquake, since 2000" />
          </div>
        </div>
      </div>
    </section>
  )
}

function Legend({ shape, label }: { shape: "square" | "dot" | "ring" | "quake"; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span
        className={cn(
          "inline-block",
          shape === "square" && "size-2.5 bg-swiss-red",
          shape === "dot" && "size-1.5 rounded-full bg-foreground",
          shape === "ring" && "size-2.5 rounded-full border-2 border-swiss-blue",
          shape === "quake" && "size-2.5 rounded-full border border-swiss-red bg-swiss-red/15",
        )}
      />
      {label}
    </span>
  )
}

/* ------------------------------------------------------------------ factors (horizontal) */

const FACTORS = [
  { title: "Power grid", stat: "380 kV", body: "Distance to the nearest substation and high-voltage line, with a bonus for 380 kV capacity." },
  { title: "Isolation", stat: "km", body: "How far the site sits from cities, towns and villages. Safety, security and room to grow." },
  { title: "Telecom", stat: "fibre", blue: true, body: "Distance to the nearest telecom exchange or data centre, plus a bonus for nearby clusters." },
  { title: "Water", stat: "m³", blue: true, body: "Distance to the nearest river, canal, lake or reservoir as a candidate cooling source." },
  { title: "Road access", stat: "A-road", body: "Distance to the nearest motorway junction, for construction traffic and daily operations." },
  { title: "Flood & seismic", stat: "× risk", body: "A multiplier that discounts the score inside mapped flood zones or near recorded earthquakes.", red: true },
]

export function FactorsSection() {
  const ref = useRef<HTMLElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const [distance, setDistance] = useState(0)

  useLayoutEffect(() => {
    const measure = () => {
      if (trackRef.current) setDistance(Math.max(0, trackRef.current.scrollWidth - window.innerWidth))
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (trackRef.current) ro.observe(trackRef.current)
    window.addEventListener("resize", measure)
    return () => {
      ro.disconnect()
      window.removeEventListener("resize", measure)
    }
  }, [])

  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] })
  const x = useTransform(scrollYProgress, [0, 1], [0, -distance])
  const smoothX = useSpring(x, { stiffness: 160, damping: 32, mass: 0.4 })
  const titleX = useTransform(scrollYProgress, [0, 1], ["0%", "-40%"])

  return (
    <section id="factors" ref={ref} className="relative h-[450vh] border-t border-foreground bg-foreground text-background">
      <div className="sticky top-0 flex h-dvh flex-col overflow-hidden pt-20 pb-8">
        <div className="flex items-baseline justify-between px-4 text-xs font-medium tracking-wide uppercase sm:px-8">
          <span>
            <span className="text-swiss-blue">02</span> — Six factors, one score
          </span>
          <span className="hidden sm:inline">Scroll →</span>
        </div>
        <motion.div
          aria-hidden
          style={{ x: titleX }}
          className="pointer-events-none absolute top-24 left-0 px-4 text-[22vw] leading-none font-bold tracking-[-0.07em] whitespace-nowrap text-background/[0.07] sm:px-8"
        >
          Evidence first
        </motion.div>
        <motion.div ref={trackRef} style={{ x: smoothX }} className="relative mt-auto flex w-max gap-4 px-4 sm:px-8">
          {FACTORS.map((f, i) => (
            <FactorCard key={f.title} index={i} progress={scrollYProgress} {...f} />
          ))}
          <div className="flex w-[85vw] shrink-0 flex-col justify-end sm:w-[38vw]">
            <p className="text-4xl leading-[0.95] font-bold tracking-tighter sm:text-6xl">
              Weighted. <br />
              <span className="text-swiss-blue">Adjustable.</span> <br />
              <span className="text-swiss-red">Explained.</span>
            </p>
            <p className="mt-6 max-w-sm text-sm text-background/60">
              Each factor scores 0–100 with its own evidence. Set the weights to match what matters to you, and the ranking
              updates live.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

function FactorCard({
  index,
  title,
  stat,
  body,
  red,
  blue,
  progress,
}: {
  index: number
  title: string
  stat: string
  body: string
  red?: boolean
  blue?: boolean
  progress: ReturnType<typeof useScroll>["scrollYProgress"]
}) {
  const start = index / (FACTORS.length + 1)
  const bar = useTransform(progress, [start, start + 0.18], [0, 1])
  return (
    <article
      className={cn(
        "group relative flex h-[56dvh] w-[85vw] shrink-0 flex-col justify-between border p-6 transition-colors duration-500 sm:h-[60dvh] sm:w-[38vw] sm:p-8",
        red ? "border-swiss-red bg-swiss-red text-white" : "border-background/25 hover:bg-background hover:text-foreground",
      )}
    >
      <div className="flex items-start justify-between">
        <span className="text-8xl leading-none font-bold tracking-tighter sm:text-[9rem]">0{index + 1}</span>
        <span className={cn("text-xs font-medium tracking-wide uppercase", !red && (blue ? "text-swiss-blue" : "text-swiss-red"))}>{stat}</span>
      </div>
      <div>
        <motion.div className={cn("mb-6 h-1 origin-left", red ? "bg-white" : blue ? "bg-swiss-blue" : "bg-swiss-red")} style={{ scaleX: bar }} />
        <h3 className="text-3xl font-bold tracking-tight sm:text-5xl">{title}</h3>
        <p className={cn("mt-3 max-w-sm text-sm leading-snug sm:text-base", red ? "text-white/85" : "opacity-60")}>{body}</p>
      </div>
    </article>
  )
}

/* ------------------------------------------------------------------ method */

const STEPS = [
  {
    title: "Drop a pin or search a place",
    body: "Click anywhere in the Netherlands, or type a town, region or plot. The map jumps there.",
  },
  {
    title: "We pull the evidence",
    body: "Distances to substations, exchanges, rivers and motorway junctions, from OpenStreetMap, PDOK and EMSC.",
  },
  {
    title: "Read a score you can check",
    body: "Every factor shows its own score and the data behind it. Missing or weak data is flagged rather than hidden.",
  },
]

export function Method() {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] })
  const bigY = useTransform(scrollYProgress, [0, 1], ["20%", "-20%"])
  return (
    <section id="method" ref={ref} className="relative grid grid-cols-12 gap-4 border-t border-foreground px-4 py-24 sm:px-8 sm:py-40">
      <div className="col-span-12 sm:col-span-4">
        <div className="sticky top-28">
          <div className="text-xs font-medium tracking-wide uppercase">
            <span className="text-swiss-red">03</span> — Method
          </div>
          <motion.div style={{ y: bigY }} className="mt-6 text-[28vw] leading-[0.8] font-bold tracking-[-0.08em] sm:text-[16vw]">
            3<span className="text-swiss-red">.</span>
          </motion.div>
          <p className="mt-4 text-sm text-muted-foreground">Steps from a pin to a decision.</p>
        </div>
      </div>
      <ol className="col-span-12 mt-12 sm:col-span-8 sm:mt-0">
        {STEPS.map((s, i) => (
          <li key={s.title} className="py-10 sm:py-16">
            <Rule delay={0.05} />
            <div className="mt-6 grid grid-cols-8 gap-4">
              <Rise className="col-span-2 font-mono text-sm text-swiss-blue">0{i + 1}</Rise>
              <div className="col-span-6">
                <h3 className="text-3xl leading-[1] font-bold tracking-tighter sm:text-6xl">
                  <MaskLine onView>{s.title}</MaskLine>
                </h3>
                <Rise delay={0.15}>
                  <p className="mt-5 max-w-md text-base text-muted-foreground">{s.body}</p>
                </Rise>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

/* ------------------------------------------------------------------ numbers */

const NUMBERS = [
  { value: NL_SUBSTATIONS.length, label: "Substations", note: "110–380 kV, OpenStreetMap" },
  { value: 4495, label: "Power lines", note: "High-voltage segments" },
  { value: NL_TELECOM.length, label: "Telecom exchanges", note: "Plus data-centre clusters" },
  { value: 31836, label: "Water features", note: "Rivers, canals, lakes" },
  { value: 1912, label: "Motorway junctions", note: "Construction access" },
  { value: 5686, label: "Candidate plots", note: "Kadaster / IBIS business parks" },
]

export function Numbers() {
  return (
    <section id="data" className="relative border-t border-foreground px-4 py-24 sm:px-8 sm:py-32">
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 text-xs font-medium tracking-wide uppercase sm:col-span-3">
          <span className="text-swiss-blue">04</span> — The data
        </div>
        <h2 className="col-span-12 text-4xl leading-[0.95] font-bold tracking-tighter sm:col-span-9 sm:text-7xl">
          <MaskLine onView>Built on public data,</MaskLine>
          <MaskLine onView delay={0.08} className="text-muted-foreground">
            not estimates.
          </MaskLine>
        </h2>
      </div>
      <div className="mt-16 grid grid-cols-2 border-t border-l border-foreground sm:grid-cols-3">
        {NUMBERS.map((n, i) => (
          <motion.div
            key={n.label}
            className="group relative overflow-hidden border-r border-b border-foreground p-5 sm:p-8"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-10% 0px" }}
            transition={{ duration: 0.6, delay: (i % 3) * 0.1 }}
          >
            <span aria-hidden className={cn("absolute inset-0 origin-bottom scale-y-0 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-y-100", i % 2 ? "bg-swiss-blue" : "bg-swiss-red")} />
            <div className="relative transition-colors duration-300 group-hover:text-white">
              <div className="text-4xl font-bold tracking-tighter sm:text-7xl">
                <CountUp to={n.value} />
              </div>
              <div className="mt-6 text-sm font-bold tracking-tight uppercase">{n.label}</div>
              <div className="text-xs text-muted-foreground transition-colors group-hover:text-white/80">{n.note}</div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ sources marquee */

const SOURCES = ["OpenStreetMap", "PDOK", "Rijkswaterstaat", "EMSC Seismic Portal", "Kadaster", "IBIS", "Overpass API"]

export function SourcesMarquee() {
  return (
    <section aria-label="Data sources" className="border-y border-foreground py-6">
      <VelocityMarquee baseVelocity={3} className="text-5xl font-bold tracking-tighter sm:text-8xl">
        {SOURCES.map((s, i) => (
          <span key={s} className="flex items-center">
            <span className={cn("px-6 sm:px-10", i % 2 === 1 && "text-transparent [-webkit-text-stroke:1.5px_var(--foreground)]")}>{s}</span>
            <span className={cn("size-3 sm:size-5", i % 2 ? "bg-swiss-blue" : "bg-swiss-red")} />
          </span>
        ))}
      </VelocityMarquee>
    </section>
  )
}

/* ------------------------------------------------------------------ CTA */

export function Cta() {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end end"] })
  const clip = useTransform(scrollYProgress, [0, 0.55], ["inset(100% 0% 0% 0%)", "inset(0% 0% 0% 0%)"])
  const scale = useTransform(scrollYProgress, [0.1, 0.8], [0.7, 1])
  const arrowX = useTransform(scrollYProgress, [0.3, 0.9], ["-40%", "0%"])

  return (
    <section ref={ref} className="relative h-[160vh]">
      <motion.div style={{ clipPath: clip }} className="sticky top-0 flex h-dvh flex-col justify-between bg-swiss-blue px-4 pt-24 pb-8 text-white sm:px-8">
        <div aria-hidden className="absolute inset-x-0 top-14 h-4 bg-swiss-red sm:h-6" />
        <div className="grid grid-cols-12 gap-4 text-xs font-medium tracking-wide uppercase">
          <span className="col-span-6 sm:col-span-3">05 — Start</span>
          <span className="col-span-6 sm:col-span-3">Free. No sign-up.</span>
        </div>
        <Link href="/explore" className="group block">
          <motion.span style={{ scale }} className="block origin-bottom-left text-[19vw] leading-[0.82] font-bold tracking-[-0.07em]">
            Pick a <br />
            <span className="inline-flex items-center gap-[0.1em]">
              site
              <motion.span style={{ x: arrowX }} className="inline-flex">
                <ArrowRight className="size-[0.8em] stroke-[2.5] transition-transform duration-500 group-hover:translate-x-[0.15em]" />
              </motion.span>
            </span>
          </motion.span>
        </Link>
        <div className="grid grid-cols-12 gap-4 border-t border-white/60 pt-4 text-xs font-medium tracking-wide uppercase">
          <span className="col-span-6 sm:col-span-3">Corkathon 2026</span>
          <span className="col-span-6 sm:col-span-3">The Netherlands</span>
          <span className="col-span-12 hidden sm:col-span-6 sm:block sm:text-right">Evidence first · Plain language · Honest uncertainty</span>
        </div>
      </motion.div>
    </section>
  )
}
