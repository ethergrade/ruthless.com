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
| Corporate | Build Department, Build Building, Raise Capital, Reduce Costs, Hire Executive / CEO / COO |
| Market & Sales | Marketing Campaign, CEO Social Post, Create Idea, Release Source Code |
| Product & R&D | Launch / Improve / Pivot Product, Create Idea, Release / Sell Source, AI Automation, Expand / Allocate Compute |
| Security & M&A | Physical Security, **Sabotage Building (arson)**, Cyber Defense, Industrial Espionage, Cyber Attack, Legal Action, Acquisition, Public Tender Offer (OPA), Auction Sell / Bid |

**Success** is estimated live (EST. SUCCESS %) before you commit. The **MAX SUCCESS ⚡**
button snaps the budget to the minimum needed for ~95% odds — no slider dragging.

### CEO & Corporation Traits (Playstyle)
Chosen at **New Game**. They silently reshape your economy:
- Banker → +10% operating costs, starts with −$2M debt (debt compounds 2×).
- Smart → +10% innovation & AI capability per turn (compounding edge).
- Initiative → free `expand_market` order every 3 turns.
- Archetype → different starting departments, cash, exec-order limits.

### Department Initiatives

Every owned department can run a named strategic order. **Product R&D** can force a
moonshot sprint, **AI & Data** a compute surge, **Cybersecurity** a zero-day drill,
**Sales** a category blitz, **HR** a culture reset, **Finance** an investor roadshow,
and the other departments have equivalent specialist initiatives.

The preview exposes both upside and backfire before planning. Success probability uses
the selected team's level, efficiency, morale and risk plus company morale and budget.
Outcomes persistently affect workforce morale, brand and market share, adoption/market
fit, compute/grid capacity, liquidity/debt, security and product health. One team can run
only one high-pressure initiative per turn; failures spend part of the budget and apply
the department-specific downside.

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

**EXPLOIT** and **INVEST** are intentionally different. Exploiting a Global Trend opens
a category/sector-locked **Expand Market** order and captures market presence without
creating a product. Investing in a weak signal opens a category/sector-bound **Launch
Product** brief, where only compatible R&D ideas can be used.

### Compute Economy & Competitive Advantage

**Compute Points** are operating capacity, not a passive score:

- Unused generation accumulates in the reserve every turn. A newly created corporation
  also receives 20 commissioning points for every starting **AI & Data** department.
- AI & Data generates `8 × level × efficiency` points per turn; **DEV Engineering**
  supplements it with `3 × level × efficiency`.
- **Expand Compute Grid** invests cash in a persistent grid (0–100), gives an immediate
  reserve, and can double department generation at level 100. Expansion has diminishing
  returns and the grid costs $1,500 per level each turn.
- **Allocate Compute** assigns up to 100 points to a product. Assigned capacity raises
  throughput by up to 50% and costs $1,000 per point per turn.
- A product that leads direct rivals in the same category and market segments earns up
  to another 20% revenue advantage. Healthy-margin products compound assigned compute;
  weak-margin products lose it.
- Unallocated compute can instead power **Cyber Attacks**, or be acquired/stolen. The
  reserve is capped at 500, so allocation and timing matter.

The AI & Data command page shows the reserve, next-turn generation, Compute Grid level,
assigned points, upkeep, throughput bonus and direct-rival edge.

### Acquisitions & Industrial Espionage

A successful company acquisition transfers the target's controlled tiles, buildings,
departments and products to the buyer, recolors the assets, and triggers a positive or
negative M&A market shock based on price, quality, profitability and buyer archetype.

Industrial Espionage creates a persistent dossier that becomes actionable on the next
turn. It can contain Compute, Cybersecurity, R&D progress, an idea or a product blueprint.
The player may exploit it for an advantage, but launching derivative IP can trigger a
lawsuit by the victim. **Re-Patent Stolen IP** requires Legal & Compliance, applies only
to stolen ideas/blueprints, and protects their derivative product lineage.

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

## Project Documentation

- [Documentation index](./DOCS/INDEX.md)
- [Mechanics and resource economy](./DOCS/03-MECHANICS.md)
- [Complete action catalog](./DOCS/04-ACTIONS.md)
- [Simulation algorithms](./DOCS/07-ALGORITHMS.md)
- [Design QA evidence](./design-qa.md)

---

## Roadmap / Design Notes
- **Scenario Editor** vs **Campaign Editor**: Scenarios are single-board tactical
  setups (fixed map, win-condition); Campaigns are multi-scenario arcs with a
  continuing corporation, narrative beats, and escalating rival AI.
- More sectors & product categories are data-driven in `src/data/generators.ts`.
- Balance is intentionally punk: high variance, sharp reversals, shark behavior.

*STRATEGYLESS — dominate, or be devoured.*
