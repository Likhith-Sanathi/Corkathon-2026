# Corkathon 2026 — Project Context

## What we're building
A platform that helps businesses buy commercial property with confidence.

For a given building, it shows:
1. **Whether it's priced fairly** — valuation against comparable properties and market data.
2. **What it's likely to earn** — projected income and returns.
3. **What could go wrong** — risks that affect the investment.

The goal is to let decision-makers act on evidence instead of gut feel.

## Core principles
- **Evidence first.** Every verdict (fair price, projected return, risk) should show the data behind it and where that data came from.
- **Plain language.** Decision-makers are not necessarily real estate analysts. Explain numbers and risks clearly.
- **Be honest about uncertainty.** Show ranges and confidence, not false precision. Flag missing or weak data.

## Tech stack
See `TECH_STACK.md` for details. In short:
- **Next.js** (App Router) for frontend and backend
- **Tailwind CSS** + **shadcn/ui** for styling
- **Inter** (Google Fonts) for typography
- **Lenis** for smooth scrolling, **Motion** (`motion`) for animation
- **FastAPI** service for LLM work via **OpenRouter** (optional)

## Working conventions
- Keep the hackathon scope tight: a working end-to-end flow for a single property beats broad, unfinished features.
- Keep API keys server-side. Never expose them with `NEXT_PUBLIC_`.
- Commit messages and PRs follow the attribution rules set in the user's environment.
