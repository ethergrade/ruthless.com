# STRATEGYLESS — Corporate Warfare Simulator

> *"In business, the enemy is not your competitor. It's the market itself — and the market is a shark."*
> A turn-based corporate-strategy game inspired by Tom Clancy's **ruthless.com**.
> Build your empire, sabotage rivals, ride global trends, and dominate the market map.

![strategyless](https://img.shields.io/badge/status-playable-00d4aa) ![stack](https://img.shields.io/badge/TS%2FReact%2FVite%2FPhaser-000000)

---

## The Fiction (Storytelling)

You are the **CEO** of a scrappy tech firm in a saturated, cut-throat market.
Around you, legacy giants and hungry upstarts fight for the same tiles, the same
segments, the same restless capital. Every turn you issue **Executive Orders** —
launch products, build departments, run espionage, bomb a rival's building with
arson, or quietly **self-sabotage** to manipulate the sharks of the market.

The world is alive: **bull rallies** lift every valuation, **market corrections**
claw back cash, **breakthrough technologies** open new categories, and the
occasional **cataclysm** (supply-chain collapse, regulatory storm) reshapes the board.

Your **CEO trait** defines your destiny:
- **Hunt (Banker)** — leverages debt to the teeth. High reward, fragile if cash stalls.
- **Jersild (Smart)** — learns fast; capabilities compound +10% every turn.
- **Laingang (Initiative)** — drives hard; a free expansion order every 3 turns.
- **Balanced Operator** — steady, predictable baseline.

Your **Corporation archetype** shapes your opening move:
- **Hypergrowth Platform** — aggressive expansion, high burn.
- **Security Fortress** — slow, trusted, regulated.
- **Acquisition Machine** — roll-up scale via M&A.
- **Lean Specialist** — niche dominance, high margins.

---

## Core Mechanics

### Market Map (Tiles & Segments)
The world is a hex/iso map of **market tiles**, each belonging to a **segment**
(Enterprise, Public Sector, Regulated, Innovation Hub, Price-Sensitive, High-Growth,
Legacy, Strategic Account, Startup Zone, Open Market). A tile's **border color** shows
its segment; a company's **fill color** shows who controls it; the **glow intensity**
shows that company's market-share strength on the tile.

Control a tile → collect its revenue every turn. Contest a rival's tile to steal it.

### Executive Orders (Actions)
Each turn you queue **Executive Orders** (planned actions). At **End Turn** they resolve.
Categories:

| Group | Actions |
|-------|---------|
| Corporate | Launch Product, Improve Product, Build Department, Build Building, Expand Market, Raise Capital, Reduce Costs, Hire Executive |
| Market & Sales | Marketing Campaign, CEO Social Post, Create Idea, Release Source Code |
| Security & M&A | Physical Security, **Sabotage Building (arson)**, Cyber Defense, Industrial Espionage, Cyber Attack, Legal Action, Public Tender Offer (OPA), Auction Sell / Bid |
| Research | Create Idea (R&D), AI Automation |

**Success** is estimated live (EST. SUCCESS %) before you commit. The **MAX SUCCESS ⚡**
button snaps the budget to the minimum needed for ~95% odds — no slider dragging.

### CEO & Corporation Traits (Playstyle)
Chosen at **New Game**. They silently reshape your economy:
- Banker → +10% operating costs, starts with −$2M debt (debt compounds 2×).
- Smart → +10% innovation & AI capability per turn (compounding edge).
- Initiative → free `expand_market` order every 3 turns.
- Archetype → different starting departments, cash, exec-order limits.

### Offensive vs Defensive (Shark Market)
- **Offensive actions** (Cyber Attack, Sabotage, Espionage, Legal) target **rival tiles / corporations only**.
- **Self-sabotage** actions let *you* damage your own assets to pilot the market —
  triggering shareholder, consumer, or market reactions (positive or negative).
  This is the **Shark Market**: a firm that self-sabotages can earn a rebound if the
  narrative lands.

### Trends & Weak Signals (TREND tab)
Global **trends** demand specific product categories in specific sectors (e.g.
*"Cyber for Finance"*). The **TREND tab** surfaces these plus **weak signals** —
early hints you can exploit by launching the right product or running the right campaign
before competitors react. Creating ideas and **releasing source code** shifts trends and
builds **trust / awareness**.

### News & Events
A live **news feed** reports Bull Market Rallies, Market Corrections, Breakthroughs,
Security Breaches, Cataclysms, and your own action outcomes. Events move the market.

### Auction House & OPA
List assets (products, buildings, departments, patents) on the **Auction House**; rivals
bid. Launch a **Public Tender Offer** to buy a rival's buildings outright.

---

## How to Play (Quick Start)
1. **New Game** → name your corp, pick an **archetype**, pick a **CEO trait**, choose disasters.
2. **+ ADD ORDER** → pick an action, configure it (target tile / department / budget), watch EST. SUCCESS.
3. Hit **MAX SUCCESS ⚡** for a safe budget, or push your luck with less.
4. **End Turn** → orders resolve, market moves, news flows.
5. Expand your **tile control**, out-innovate rivals, and watch the **TREND** tab for openings.
6. Use **Sabotage / Cyber / Legal** on rivals; use **self-sabotage** to pilot sentiment.

---

## Tech Stack
- **TypeScript + React + Vite** (UI)
- **Phaser 3** (canvas market map)
- **Zustand** (state) + a deterministic **TurnEngine** (pure simulation, seedable)
- **Vitest** (tests)

```
npm install
npm run dev        # http://localhost:5173
npm run build      # production build
npx tsc --noEmit   # typecheck
npm run lint       # eslint
npx vitest run     # tests
```

---

## Roadmap / Design Notes
- **Scenario Editor** vs **Campaign Editor**: Scenarios are single-board tactical
  setups (fixed map, win-condition); Campaigns are multi-scenario arcs with a
  continuing corporation, narrative beats, and escalating rival AI.
- More sectors & product categories are data-driven in `src/data/generators.ts`.
- Balance is intentionally punk: high variance, sharp reversals, shark behavior.

*STRATEGYLESS — dominate, or be devoured.*
