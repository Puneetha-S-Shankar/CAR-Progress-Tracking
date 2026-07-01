# Internly UI Design System — How It's Built & How to Replicate It

This document explains **exactly** how the entire UI of this application (the `components/` Next.js app) is constructed, what art style it uses, how it maps onto the **`taste-skill`** (Senior UI/UX Engineer skill at `.claude/skills/taste-skill/skills/taste-skill/SKILL.md`), and a step-by-step recipe so anyone can reproduce the _exact same look and feel_ in a brand-new application using that same skill.

---

## 1. The Art Style In One Sentence

> **Neo-Brutalism** — flat surfaces, **thick 2px solid borders**, **hard offset drop-shadows with zero blur**, high-contrast type, a single desaturated accent, fully token-driven light/dark theming, and tactile "physical push" micro-interactions.

It is _not_ glassmorphism, _not_ gradient-heavy SaaS, _not_ Material. Every interactive element looks like a physical card that can be pressed: it lifts toward the cursor on hover (shadow grows) and presses down on click (shadow collapses).

---

## 2. The Exact Tech Stack (verified from `package.json`)

| Concern   | Choice                                                                                                   |
| --------- | -------------------------------------------------------------------------------------------------------- |
| Framework | **Next.js 16** (App Router) + **React 19**                                                               |
| Styling   | **Tailwind CSS v4** (`@import "tailwindcss"` + `@theme inline`)                                          |
| PostCSS   | `@tailwindcss/postcss` (v4-correct — no legacy `tailwindcss` plugin)                                     |
| Fonts     | **Plus Jakarta Sans** (display/body) + **JetBrains Mono** (numbers/code) via `next/font/google`          |
| Icons     | Hand-inlined **SVG primitives** (no emoji, no icon lib)                                                  |
| State     | Local `useState` / `useEffect`; `createPortal` for modals                                                |
| Theming   | **CSS custom properties** on `:root` and `.dark`, toggled by adding/removing a `.dark` class on `<html>` |

This is fully compliant with the `taste-skill` Section 2 conventions: Tailwind v4 with the correct PostCSS guard, CSS Grid over flex-math, SVG icons instead of emoji.

---

## 3. The Design Tokens (the single source of truth)

Everything visual is driven by CSS variables defined in `components/src/app/globals.css`. **This is the heart of the system — copy this block and you have 80% of the look.**

```css
/* Light Mode (default) */
:root {
  --background: #f9f9fb;
  --foreground: #000000;
  --card: #ffffff;
  --card-border: #000000; /* pure-black borders = the brutalist signature */
  --card-hover: #f1f1f1;
  --accent: #8b5cf6; /* single accent (violet) */
  --accent-light: #a78bfa;
  --accent-dim: rgba(139, 92, 246, 0.1);
  --accent-glow: rgba(139, 92, 246, 0.2);
  --muted: #4b5563;
  --success: #10b981;
  --error: #ef4444;
  --warning: #f59e0b;
  --surface-1: #ffffff;
  --surface-2: #f3f4f6;
  --header-bg: #f9f9fb;
  --shadow-color: #000000;
  --shadow-brutal: 4px 4px 0 var(--shadow-color); /* note: 0 blur */
  --shadow-brutal-lg: 6px 6px 0 var(--shadow-color);
  --shadow-brutal-sm: 2px 2px 0 var(--shadow-color);
  --border-width: 2px;
  --radius: 16px;
  --radius-sm: 12px;
  --radius-lg: 24px;
  --radius-pill: 9999px;
  --overlay-bg: rgba(0, 0, 0, 0.6);
}

/* Dark Mode — same keys, re-mapped values */
.dark {
  --background: #18181b; /* zinc-900, NOT pure black */
  --foreground: #f4f4f5;
  --card: #27272a;
  --card-border: #3f3f46; /* borders soften in dark mode */
  --accent: #a78bfa; /* accent lightens for contrast */
  /* ...success/error/warning all shift to their lighter variants... */
}
```

**Key takeaways for replication:**

- The brutalist signature = `--card-border: #000000` + `--shadow-brutal: 4px 4px 0` (the `0` blur radius is what makes it "hard"/brutalist instead of soft SaaS).
- Dark mode never uses `#000000` for surfaces — it uses **Zinc-900 (`#18181b`)**, which matches the `taste-skill` "NO Pure Black" rule.
- There is **exactly one accent** (violet), reused everywhere via `--accent`, `--accent-dim` (10% tint background), and `--accent-glow`.

> Honest note vs. the skill: the `taste-skill` has a "LILA BAN" (no AI-purple). This app deliberately keeps a violet accent as its brand color. To be _strictly_ skill-compliant you would swap `--accent` to Emerald / Electric-Blue / Deep-Rose and keep everything else identical. The system is built so this is a **one-line change**.

---

## 4. The Tailwind v4 Theme Bridge & Fonts

In `globals.css`, the CSS variables are exposed to Tailwind and the font stack is wired up:

```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: "Plus Jakarta Sans", system-ui, -apple-system, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;
}

html {
  font-size: 17.5px;
} /* slightly larger root for a confident, readable scale */
body {
  background: var(--background);
  color: var(--foreground);
  font-weight: 500; /* body text is medium, not 400 — adds weightiness */
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
}
```

Fonts are loaded in `components/src/app/layout.tsx` via `next/font/google` (self-hosted, no layout shift):

```tsx
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], display: "swap" });
```

This satisfies the `taste-skill` typography rule: **no `Inter`**, a distinctive sans for display + a mono for all numeric/technical data.

---

## 5. The Four Reusable "Neo" Component Classes

Instead of repeating Tailwind utilities, the system defines four hand-rolled classes in `globals.css`. **These are the building blocks every component uses.**

### `.neo-card` — the pressable surface

```css
.neo-card {
  background: var(--card);
  border: var(--border-width) solid var(--card-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-brutal);
  transition:
    transform 0.2s cubic-bezier(0.16, 1, 0.3, 1),
    box-shadow 0.2s cubic-bezier(0.16, 1, 0.3, 1),
    border-color 0.2s ease;
}
.neo-card:hover {
  transform: translate(-2px, -2px);
  box-shadow: var(--shadow-brutal-lg);
  border-color: var(--accent);
}
.neo-card:active {
  transform: translate(1px, 1px);
  box-shadow: 1px 1px 0 var(--shadow-color);
}
```

### `.neo-button` — pill, tactile

```css
.neo-button {
  border: 2px solid var(--card-border);
  border-radius: 9999px;
  box-shadow: var(--shadow-brutal-sm);
  cursor: pointer;
}
.neo-button:hover {
  transform: translate(-2px, -2px);
  box-shadow: 3px 3px 0 var(--shadow-color);
  border-color: var(--accent);
}
.neo-button:active {
  transform: translate(1px, 1px);
  box-shadow: 0 0 0 var(--shadow-color);
}
.neo-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}
```

### `.neo-input` — focus ring uses the accent tint

```css
.neo-input {
  background: var(--surface-1);
  border: 2px solid var(--card-border);
  border-radius: 12px;
  outline: none;
}
.neo-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-dim);
}
```

### `.neo-chip` — filter pills with active state

```css
.neo-chip {
  border: 2px solid var(--card-border);
  border-radius: 9999px;
  cursor: pointer;
}
.neo-chip:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.neo-chip.active {
  background: var(--accent-dim);
  border-color: var(--accent);
  color: var(--accent);
}
```

**The motion physics** (`taste-skill` Rule 5 "Tactile Feedback"): hover = lift up-left by 2px and grow the hard shadow; active = drop 1px down-right and collapse the shadow to near-zero. This is the _entire_ interaction language of the app, applied consistently to cards, buttons, chips, and inputs.

---

## 6. Dark-Mode-Only Glow (the one place blur is allowed)

In light mode shadows are hard and blur-free (brutalist). In dark mode a subtle accent glow is layered _on top_ of the hard shadow so elements read against the dark surface:

```css
.dark .neo-card:hover {
  box-shadow:
    var(--shadow-brutal-lg),
    0 0 25px var(--accent-dim);
}
.dark .neo-button:hover {
  box-shadow:
    3px 3px 0 var(--shadow-color),
    0 0 15px var(--accent-dim);
}
.dark .neo-input:focus {
  box-shadow:
    0 0 0 3px var(--accent-dim),
    0 0 15px var(--accent-glow);
}
```

---

## 7. The Motion Library (CSS keyframes, not JS)

The app keeps `MOTION_INTENSITY` in the **fluid-CSS** band (taste-skill level 4–7): all motion is CSS `@keyframes` + `cubic-bezier(0.16, 1, 0.3, 1)` easing, animating only `transform`/`opacity` (hardware-accelerated, per the skill's performance guardrails). No Framer Motion, no scroll listeners.

| Keyframe                | Used for                                        |
| ----------------------- | ----------------------------------------------- |
| `fadeInUp`              | every card/row mount-in (`.animate-fade-in-up`) |
| `slideDown`             | banners / dropdowns appearing                   |
| `breathe`               | "live" status dots (scale + opacity pulse)      |
| `progressPulse`         | loading progress hints                          |
| `shimmer`               | skeleton loaders                                |
| `spin`                  | loading spinners                                |
| `modalIn` / `overlayIn` | modal + backdrop entrance                       |

### Staggered reveals (taste-skill "Staggered Orchestration")

Lists don't pop in all at once. Each item gets a `stagger-N` class that adds `animation-delay`:

```css
.stagger-1 {
  animation-delay: 0.04s;
} /* ... up to ... */
.stagger-10 {
  animation-delay: 0.4s;
}
```

In `JobCard.tsx`: ``const staggerClass = `stagger-${Math.min(index + 1, 10)}`;`` produces a waterfall reveal of result cards.

### Skeleton shimmer (taste-skill Rule 5 "Loading")

```css
.skeleton {
  background: linear-gradient(
    90deg,
    var(--surface-1) 25%,
    var(--surface-2) 50%,
    var(--surface-1) 75%
  );
  background-size: 800px 100%;
  animation: shimmer 1.8s infinite linear;
}
```

---

## 8. Component Architecture Patterns (how the pieces fit)

### Layout shell (`StudentDashboard.tsx`)

- **Sticky header**: `sticky top-0 z-50` with `borderBottom: 2px solid var(--card-border)` and `background: var(--header-bg)`.
- **Centered container**: `max-w-6xl mx-auto px-6` for both header and `<main>` (taste-skill responsiveness rule — contained, centered page width).
- **Responsive collapse**: header is `flex-col md:flex-row` so it stacks cleanly on mobile (`w-full`, `px-` fallback — taste-skill mobile-override rule).
- Header right-side cluster: a `Ratings` link, a `Refresh` button (spinner via `animate-spin` when `loading`), a **live status pill** (color + breathing dot driven by `loading`/`error`/`success`), `<ThemeToggle/>`, and `<AccountButton/>`.

### Full interaction-state coverage (taste-skill Rule 5)

`StatusBanner.tsx` is the textbook example — it renders **four distinct states** from one `status` prop:

- `idle` → renders nothing
- `loading` → spinner + animated breathing progress dots + sanitized progress messages
- `error` → red-bordered card, inline error message, recovery hint
- `success` → green-bordered card with count + "Complete" badge

This is exactly the "never ship only the happy path" directive: loading, empty, and error states all exist.

### Modals via Portal (`JobCard.tsx` → `MessageModal`)

- Rendered through `createPortal(overlay, document.body)` so it escapes overflow/stacking contexts.
- Backdrop: `fixed inset-0 z-[9999]` + `rgba(0,0,0,0.55)` + `backdrop-filter: blur(4px)`.
- Panel: `var(--card)` + `2px solid var(--card-border)` + `--shadow-brutal-lg`, entering with `.animate-fade-in-up`.
- Click-outside closes; inner click `stopPropagation()`; includes **live character counter** that turns red past 200 chars (inline form validation — taste-skill Rule 6).

### Star rating (`StarRating`)

Hand-built SVG stars with half-fill via an SVG `linearGradient`, color-coded by score (`--success` > 4, `--warning` ≥ 3, else `--error`). Numbers shown in mono. No icon library, no emoji.

### Theme toggle (`ThemeToggle.tsx`)

- Reads `localStorage.theme` + `prefers-color-scheme` on mount, toggles the `.dark` class on `document.documentElement`.
- Renders an **inert placeholder of identical dimensions before mount** to prevent hydration flash/layout shift — a premium detail most implementations skip.

---

## 9. Data & Content Rules Observed

- **All numbers/timers/elapsed times** use `font-mono` (JetBrains Mono) — matches taste-skill data-display convention.
- Source badges are color-coded with brand-tinted backgrounds (LinkedIn `#0A66C2`, Adzuna green, etc.), each with a `1.5px` colored border and 10%-tint fill — the same border+dim-fill recipe as the accent.
- Copy is concrete and task-focused ("Discovering opportunities…", "{n} opportunities discovered") rather than AI filler words.

---

## 10. How To Replicate This In A New App (Step-By-Step Recipe)

Follow these steps to get a pixel-faithful clone of this aesthetic in any new React/Next project, using the `taste-skill`.

### Step 0 — Prompt the taste-skill with this brief

Paste this into your agent (it pins the skill's dials to match this app):

> "Build the UI using the **design-taste-frontend** skill. Use a **Neo-Brutalist** style: `DESIGN_VARIANCE 4`, `MOTION_INTENSITY 5`, `VISUAL_DENSITY 5`. Pure-black 2px borders, hard offset shadows with **0 blur** (`4px 4px 0`), single desaturated accent, token-driven light/dark theming via CSS variables on `:root`/`.dark`. Fonts: **Plus Jakarta Sans** + **JetBrains Mono** (mono for all numbers). Tailwind v4 with `@tailwindcss/postcss`. Inline SVG icons only — no emoji. Provide `.neo-card`, `.neo-button`, `.neo-input`, `.neo-chip` utility classes with hover-lift / active-press physics, plus CSS-keyframe motion (`fadeInUp`, `shimmer`, `breathe`, `slideDown`, `modalIn`) and `stagger-N` delay classes. Every list reveals with a staggered fade-up. Always include loading (skeleton/spinner), empty, and error states."

### Step 1 — Scaffold

```bash
npx create-next-app@latest my-app --ts --app
cd my-app
```

(Tailwind v4 ships via `@tailwindcss/postcss`; confirm `postcss.config.mjs` uses it, not the legacy plugin.)

### Step 2 — Drop in the token system

Copy **Section 3 + Section 4 + Sections 5–7** CSS blocks above verbatim into `src/app/globals.css` (the `:root`/`.dark` variables, `@theme inline`, the four `.neo-*` classes, the `@keyframes`, the `.stagger-*` and `.skeleton` helpers). To be strictly taste-skill-compliant, change `--accent` from violet to Emerald (`#10b981`) / Electric-Blue / Deep-Rose and update `--accent-dim`/`--accent-glow` to matching tints.

### Step 3 — Wire fonts in `layout.tsx`

Use `next/font/google` for `Plus_Jakarta_Sans` (weights 400–800) and `JetBrains_Mono`; set `<body>` to `font-weight:500` and `html { font-size: 17.5px }`.

### Step 4 — Add the theme toggle

Reuse the `ThemeToggle.tsx` pattern: toggle `.dark` on `<html>`, persist to `localStorage`, and render a same-size placeholder until mounted.

### Step 5 — Build every component from the primitives

- Surfaces → `.neo-card` (or `.neo-card-static` for non-interactive).
- Actions → `.neo-button`.
- Inputs → `.neo-input`; filters → `.neo-chip`.
- Status/info blocks → a `StatusBanner`-style component with `idle/loading/error/success` branches.
- Overlays → `createPortal` + `fixed inset-0 z-[9999]` + blurred backdrop + `.animate-fade-in-up` panel.
- Lists → map items to cards with ``className={`neo-card animate-fade-in-up stagger-${Math.min(i+1,10)}`}``.

### Step 6 — Apply the layout shell

`sticky top-0 z-50` header with a `2px` bottom border, `max-w-6xl mx-auto px-6` container, `flex-col md:flex-row` so it collapses on mobile.

### Step 7 — Pre-flight check (run the taste-skill's matrix)

- [ ] Single accent, desaturated, consistent palette in both themes.
- [ ] No pure black surfaces in dark mode (use Zinc-900).
- [ ] All numbers in `font-mono`.
- [ ] Loading + empty + error states present everywhere data loads.
- [ ] Motion uses only `transform`/`opacity`; no `width`/`top` animation.
- [ ] Mobile collapses to single column (`w-full`, `px-4`).
- [ ] No emoji; SVG icons only.

---

## 11. File Map (where to look in this repo)

| File                                                 | Role                                                                                      |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `components/src/app/globals.css`                     | **All tokens, `.neo-*` classes, keyframes, skeleton, stagger** — the design system itself |
| `components/src/app/layout.tsx`                      | Font loading (Jakarta + JetBrains Mono), `<html>`/`<body>` shell                          |
| `components/src/app/components/ThemeToggle.tsx`      | Light/dark switch, anti-flash placeholder                                                 |
| `components/src/app/components/JobCard.tsx`          | Canonical card: badges, stars, program tags, portal modal, tactile CTA                    |
| `components/src/app/components/StatusBanner.tsx`     | Reference for loading / error / success state design                                      |
| `components/src/app/components/StudentDashboard.tsx` | Layout shell: sticky header, container width, live status pill                            |
| `components/src/app/page.tsx`                        | Login card + Suspense skeleton fallback pattern                                           |

---

### TL;DR

A **token-first Neo-Brutalist** system: every color, border, radius, and shadow is a CSS variable on `:root`/`.dark`; four `.neo-*` classes encode the hard-shadow + lift-on-hover / press-on-active physics; all motion is CSS keyframes with staggered fade-ups; numbers are mono; every data view has loading/empty/error states. To clone it, copy the token block and `.neo-*` classes, load Plus Jakarta Sans + JetBrains Mono, and build everything from those primitives — swapping the violet accent for an Emerald/Blue/Rose accent if you want full `taste-skill` compliance.
