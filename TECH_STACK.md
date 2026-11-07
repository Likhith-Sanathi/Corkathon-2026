# Corkathon 2026 — Tech Stack

## Frontend + Backend: Next.js
- **Next.js (App Router)** handles both the UI and the server side: pages, layouts, Route Handlers (`app/api/...`), and Server Actions.
- TypeScript throughout.

## Styling
- **Tailwind CSS** for utility-first styling and design tokens.
- **shadcn/ui** for accessible, copy-in components (built on Radix UI), customized with Tailwind.

## Typography
- **Google Fonts: Inter** (clean sans-serif), loaded via `next/font/google` so it is self-hosted and layout-shift free.

## Motion & Scrolling
- **Lenis** for smooth scrolling.
- **Motion** (motion.dev, npm package `motion`) for animations and transitions.

## AI Service (optional): FastAPI + OpenRouter
- **FastAPI** Python service for LLM calls, used only if needed.
- Calls **OpenRouter** API to access multiple models through one endpoint.
- The Next.js app calls the FastAPI service over HTTP; API keys stay server-side and are never exposed to the browser.

## Architecture at a glance

```
Browser
  │
  ▼
Next.js (UI + API routes / Server Actions)
  │                       │
  │ (optional)            ▼
  └──────────────► FastAPI service ──► OpenRouter API
```

## Environment variables
- `OPENROUTER_API_KEY` — lives in the FastAPI service (or Next.js server if FastAPI is skipped).
- Never prefix secrets with `NEXT_PUBLIC_`.
