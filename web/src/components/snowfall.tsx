"use client"

import { useMemo, useSyncExternalStore } from "react"
import { Snowflake } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const FLAKE_COUNT = 60
const STORAGE_KEY = "corkathon-snow"
const CHANGE_EVENT = "corkathon-snow-changed"

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange)
  return () => window.removeEventListener(CHANGE_EVENT, onChange)
}
const getSnapshot = () => localStorage.getItem(STORAGE_KEY) === "1"
const getServerSnapshot = () => false

/** Whether the snow overlay is on, read from localStorage (set before paint has no effect here — it's opt-in). */
function useSnowOn() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

type Flake = { left: number; size: number; opacity: number; duration: number; delay: number; drift: number }

function makeFlakes(n: number): Flake[] {
  return Array.from({ length: n }, () => ({
    left: Math.random() * 100,
    size: 3 + Math.random() * 6,
    opacity: 0.35 + Math.random() * 0.55,
    duration: 8 + Math.random() * 12,
    delay: -Math.random() * 20,
    drift: (Math.random() * 2 - 1) * 60,
  }))
}

function Snowfall() {
  const flakes = useMemo(() => makeFlakes(FLAKE_COUNT), [])
  return (
    <div className="pointer-events-none fixed inset-0 z-[2000] overflow-hidden" aria-hidden>
      {flakes.map((f, i) => (
        <span
          key={i}
          className="snowflake"
          style={
            {
              left: `${f.left}%`,
              width: f.size,
              height: f.size,
              opacity: f.opacity,
              animationDuration: `${f.duration}s`,
              animationDelay: `${f.delay}s`,
              "--drift": `${f.drift}px`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  )
}

/** A small toggle (persisted) that turns a festive snow overlay on or off anywhere it's mounted. */
export function SnowToggle() {
  const on = useSnowOn()

  const toggle = () => {
    localStorage.setItem(STORAGE_KEY, on ? "0" : "1")
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={toggle}
        aria-label={on ? "Turn off snow" : "Turn on snow"}
        aria-pressed={on}
      >
        <Snowflake className={cn(on && "text-sky-400")} />
      </Button>
      {on && <Snowfall />}
    </>
  )
}
