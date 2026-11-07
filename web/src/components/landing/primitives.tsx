"use client"

import { useEffect, useRef, useState } from "react"
import {
  animate,
  motion,
  useAnimationFrame,
  useInView,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
  useVelocity,
  type MotionValue,
} from "motion/react"
import { cn } from "@/lib/utils"

export const EASE = [0.16, 1, 0.3, 1] as const

/** A line of text that slides up out of a clipping mask, on mount or when scrolled into view. */
export function MaskLine({
  children,
  delay = 0,
  className,
  onView = false,
}: {
  children: React.ReactNode
  delay?: number
  className?: string
  onView?: boolean
}) {
  // The observer sits on the unclipped wrapper: the inner span starts outside the mask, so it never "intersects".
  const trigger = onView
    ? { initial: "hidden", whileInView: "show", viewport: { once: true, margin: "-10% 0px" } }
    : { initial: "hidden", animate: "show" }
  return (
    <motion.span className={cn("block overflow-hidden pb-[0.08em]", className)} {...trigger}>
      <motion.span
        className="block will-change-transform"
        variants={{ hidden: { y: "110%" }, show: { y: "0%" } }}
        transition={{ duration: 1.1, delay, ease: EASE }}
      >
        {children}
      </motion.span>
    </motion.span>
  )
}

/** A thin rule that draws itself left to right when it enters the viewport. */
export function Rule({ className, delay = 0, red = false }: { className?: string; delay?: number; red?: boolean }) {
  return (
    <motion.div
      aria-hidden
      className={cn("h-px w-full origin-left", red ? "bg-swiss-red" : "bg-foreground", className)}
      initial={{ scaleX: 0 }}
      whileInView={{ scaleX: 1 }}
      viewport={{ once: true, margin: "-5% 0px" }}
      transition={{ duration: 1.4, delay, ease: EASE }}
    />
  )
}

/** Fades and lifts its children in when scrolled into view. */
export function Rise({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-8% 0px" }}
      transition={{ duration: 0.9, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  )
}

/** Counts from 0 to `to` the first time it becomes visible. */
export function CountUp({ to, duration = 1.8, className }: { to: number; duration?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: "-10% 0px" })
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!inView) return
    const controls = animate(0, to, { duration, ease: EASE, onUpdate: (v) => setValue(Math.round(v)) })
    return () => controls.stop()
  }, [inView, to, duration])
  return (
    <span ref={ref} className={cn("tabular-nums", className)}>
      {value.toLocaleString("en-GB")}
    </span>
  )
}

/** Paragraph whose words light up one by one as it scrolls through the viewport. */
export function ScrollWords({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 85%", "end 45%"] })
  const words = text.split(" ")
  return (
    <p ref={ref} className={cn("flex flex-wrap", className)}>
      {words.map((word, i) => (
        <Word key={i} progress={scrollYProgress} range={[i / words.length, (i + 1) / words.length]}>
          {word}
        </Word>
      ))}
    </p>
  )
}

function Word({ children, progress, range }: { children: string; progress: MotionValue<number>; range: [number, number] }) {
  const opacity = useTransform(progress, range, [0.12, 1])
  const y = useTransform(progress, range, [8, 0])
  const red = children.startsWith("*")
  const blue = children.startsWith("~")
  return (
    <motion.span style={{ opacity, y }} className={cn("mr-[0.25em] inline-block", red && "text-swiss-red", blue && "text-swiss-blue")}>
      {red || blue ? children.slice(1) : children}
    </motion.span>
  )
}

const wrap = (min: number, max: number, v: number) => {
  const range = max - min
  return ((((v - min) % range) + range) % range) + min
}

/** Infinite ticker whose speed and direction follow how fast the page is being scrolled. */
export function VelocityMarquee({ children, baseVelocity = 4, className }: { children: React.ReactNode; baseVelocity?: number; className?: string }) {
  const baseX = useMotionValue(0)
  const { scrollY } = useScroll()
  const smoothVelocity = useSpring(useVelocity(scrollY), { damping: 50, stiffness: 400 })
  const factor = useTransform(smoothVelocity, [0, 1000], [0, 5], { clamp: false })
  const x = useTransform(baseX, (v) => `${wrap(-25, 0, v)}%`)
  const direction = useRef(-1)

  useAnimationFrame((_, delta) => {
    let move = direction.current * baseVelocity * (delta / 1000)
    const f = factor.get()
    if (f < 0) direction.current = 1
    else if (f > 0) direction.current = -1
    move += direction.current * move * f
    baseX.set(baseX.get() + move)
  })

  return (
    <div className={cn("flex overflow-hidden whitespace-nowrap", className)}>
      <motion.div className="flex flex-nowrap" style={{ x }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex shrink-0 flex-nowrap" aria-hidden={i > 0}>
            {children}
          </div>
        ))}
      </motion.div>
    </div>
  )
}
