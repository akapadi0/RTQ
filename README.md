# Wealth IQ — RTQ + IPS Generator (PlannerXchange app)

A two-part Risk Tolerance Questionnaire modeled on Andy Baxley's "Risk
Compass" (presented at the 2026-04-28 AI Lunch Club), plus a generator that
turns results into a Wealth IQ-branded Investment Policy Statement
(`.pptx`), matching the firm's existing IPS template and Linda Sun's filled
example.

Built as a **PlannerXchange app** — same pattern as `CashflowGenAI`,
`Goalsvisualization-main`, and `MoneyMindsetPX`. No builder-owned backend:
persistence and email both run through PlannerXchange's own app-data and
app-email services (`client/src/plannerxchange.ts`,
`client/src/lib/px-data.ts`, `client/src/lib/px-email.ts`). There is no
Express server, no Postgres, no SMTP credentials, and nothing to deploy to
Vercel/Railway/etc. — everything here is a static bundle the PX shell loads.

## Stack

React + Vite + Tailwind/shadcn-style components + framer-motion, matching
your other two apps' design system. pptxgenjs runs **client-side** (it
supports both Node and browser output) to generate the IPS and trigger a
browser download — that's what removes the last thing that would've
otherwise needed a server.

## Setup

```bash
npm install
npm run dev      # vite dev server — runs standalone via main.tsx, no PX connection needed
```

Outside the PlannerXchange shell (local dev, or the manifest's public demo
mode), `px-data.ts` falls back to an in-memory store and `px-email.ts`
reports itself unavailable — same graceful-degradation pattern the sibling
apps use, so you can build/iterate on the UI without needing a live shell
connection.

## The PlannerXchange contract

- **`plannerxchange.app.json`** — the app manifest: slug, permissions
  (`branding.read`, `app_data.read`, `app_data.write`, `email.send`), and a
  `dataIngressDeclarations` entry describing what this app stores (client
  name/email, questionnaire answers, advisor capacity inputs — all via
  PlannerXchange's own app-data store, nothing else). **Set to
  `visibility: "private"`** — this is your own tool, not
  marketplace-listed like your other three apps. Flip that if you actually
  want other advisors to be able to install it.
- **`client/src/plugin.tsx`** — the shell entry point. Exports `{ mount,
  manifest }`. The shell calls `mount(shellRuntimeContext)`; `main.tsx`
  (local dev only) calls `mount(domElement)` instead — same dual-mode
  pattern as your other PX apps.
- **`client/src/lib/px-data.ts`** — persistence via `POST/PATCH
  /app-data` with `recordType: "rtq_response"`. One record per client
  holds Part 1 answers, Part 2 answers, and the advisor's capacity inputs
  together — there's no relational schema anymore, just one JSON payload
  PlannerXchange stores for you.
- **`client/src/lib/px-email.ts`** — copied verbatim from your other
  apps; sends through `POST /app-email/send`, gated on the `email.send`
  permission actually being granted on this app's installation.
- **`client/src/lib/ips-generator.ts`** — the same section structure and
  compliance reasoning as before, just running in the browser and
  triggering a `.pptx` download instead of returning a server response.

## Flow

1. Client fills out **Part 1** (`/`, `/part1`) — ranks the five life-risk
   categories, two capped free-response prompts. Creates an app-data
   record.
2. Client fills out **Part 2** (`/part2/:id`) — actual behavior in the
   March 2020 and 2022 downturns, feelings/regret questions, time horizon
   per account type. On submit, a results email goes to the client and to
   the fixed advisor address in `client/src/lib/rtq-email.ts`
   (`aditi@wealthiqco.com` — change this constant if that should ever be
   configurable instead of hardcoded).
3. **You** open `/advisor/:id` (not linked from the client flow — see
   Known gaps) and enter capacity inputs: age, income stability, goal
   coverage. Kept separate from the client-facing form on purpose, per
   your note that some of this should stay a conversation you have, not a
   questionnaire the client fills out.
4. Click **Download IPS** — generates and downloads the `.pptx` right in
   the browser.

## Scoring methodology (`shared/scoring.ts`)

Unchanged from the original design — fully deterministic, no LLM in this
path, same design choice Andy and Michael both made for compliance
reasons. Every weight and threshold is a named constant so you (or your
compliance consultant) can review and recalibrate them. Two scores are kept
separate on purpose:

- **Capacity** ("ability to take risk") — from the advisor-entered inputs.
- **Desire** ("willingness to take risk") — from Part 2, computed
  separately for retirement vs. non-retirement accounts, mapped to the
  six-tier system (Preservation → Opportunity) Andy described.

A large capacity/desire gap triggers a `flagged` divergence, the same
pattern as Michael's "capacity 87 / preference 48" example.

## The IPS output (`client/src/lib/ips-generator.ts`)

Still a `.pptx`, not a PDF — the firm's own Proposal Generator tried an
HTML/browser-print-to-PDF pipeline and abandoned it as unreliable. Section
structure mirrors `WealthIQKnowledgeBase/Investment process/IPS
template.pptx`, with `[Advisor: ...]` placeholders for plan-level content
this tool has no basis to generate, plus a **Methodology & AI-Use
Disclosure** section worded to line up with `Two Trails — Recommended ADV
Disclosure Language` (on file in `Wealth IQ/COMPLIANCE/Policies and
Procedures/AI Additions/`). Asset Allocation states the risk tier as a
narrative band, not a fixed percentage, per Michael's explicit rationale
about not giving a regulator "rope to hang you with."

**Do not treat a generated IPS as exam-ready without reviewing it.**

## Publishing to PlannerXchange

I haven't pushed or connected anything — that part needs your PX
publisher access, the same way your other three apps got connected
(this repo has no `.github/workflows`, so it looks like that's a manual
step through the PX builder dashboard / repo connection, not an automated
CI pipeline). What's ready on this end:

- `npm run build` produces `dist/public/assets/plugin-*.{js,css}` from the
  `client/src/plugin.tsx` entry — same output shape as your other apps'
  `plannerxchange.publish.json` expects.
- `plannerxchange.app.json` is in place with permissions and data
  declarations filled in.

## Known gaps / next steps

- **No authentication** on `/advisor/:id` beyond whatever PlannerXchange
  itself gates the app behind — fine since nothing more sensitive than
  name/email/risk answers is collected, but there's no separate in-app
  check that the viewer is actually the advisor.
- **Scoring weights are a starting point**, not validated psychometrics —
  calibrate against real client profiles (Linda Sun's known RTQ-75 / 80-20
  result is a reasonable first sanity check) before relying on this for
  real recommendations.
- **Return Objectives, Constraints, and other plan-specific IPS sections**
  are left as placeholders — this tool only has the risk-tolerance inputs,
  not the full financial plan.
- The advisor-recipient email is a hardcoded constant, not read from the
  PlannerXchange user context (the shell doesn't expose the installer's
  email address, only `userId`) — fine for a private single-advisor tool,
  worth revisiting if this ever supports multiple advisors.
