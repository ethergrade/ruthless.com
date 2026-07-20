# STRATEGYLESS design QA

## Evidence

- Source visual truth:
  - `/Users/lucasalvatori/Documents/ruthless.com/CONTENT/tom-clancy-s-ruthless-com_2.webp`
  - `/Users/lucasalvatori/Documents/SCREENSHOT/Screenshot 2026-07-18 alle 11.53.37.png`
- Implementation screenshots:
  - `/Users/lucasalvatori/Documents/ruthless.com/.codex/screenshots/menu-1440-pass2.png`
  - `/Users/lucasalvatori/Documents/ruthless.com/.codex/screenshots/gameplay-1440-final.png`
  - `/Users/lucasalvatori/Documents/ruthless.com/.codex/screenshots/campaign-editor-1440.png`
  - `/Users/lucasalvatori/Documents/ruthless.com/.codex/screenshots/menu-1024.png`
  - `/Users/lucasalvatori/Documents/ruthless.com/.codex/screenshots/campaign-editor-1024.png`
  - `/Users/lucasalvatori/Documents/ruthless.com/.codex/screenshots/menu-768.png`
- Combined comparison evidence:
  - `/Users/lucasalvatori/Documents/ruthless.com/.codex/screenshots/menu-comparison-pass2.png`
  - `/Users/lucasalvatori/Documents/ruthless.com/.codex/screenshots/gameplay-comparison-pass2.png`
- Viewports: 1440×900, 1024×768, 768×768.
- States: main menu, Campaign Editor with two-node valid graph, Campaign playtest turn 1, Sandbox setup and open God Mode console.
- Browser-rendered evidence: local Vite build at `http://127.0.0.1:4173/` in the Codex in-app browser.

## Full-view comparison

The menu preserves the source hierarchy (dominant title, left-first mode navigation, industrial circuitry backdrop) while using an original widescreen asset and a denser two-column modern navigation. The gameplay shell preserves the source's top ticker, isometric market, corporation-coded territories and persistent lower command deck. Side information is rendered as translucent overlays so the market remains the dominant surface.

The Campaign Editor has no one-to-one source screen in the original. It was checked against the established visual language: cyan/copper instrumentation, squared industrial controls, grid-backed network canvas and high-density inspector.

## Focused-region comparison

- Header/ticker: checked at 1440 px after initial overflow was found. Final capture keeps company, turn policy, financial KPIs and all persistent actions visible.
- Map/command deck boundary: checked after the first capture placed the market too low. Final capture centers the full active board above the command deck.
- Campaign inspector: checked at 1440 and 1024. Title, briefing, duration, board, AI, final-state toggle and transition builder remain visible and operable.
- Compact menu: checked at 768. All eight entries remain visible without horizontal overflow.

## Required fidelity surfaces

- Fonts and typography: compact mono instrumentation and high-contrast editorial display title preserve the original hierarchy; small labels remain legible at tested breakpoints.
- Spacing and layout rhythm: squared rails, tight table-like spacing and the persistent command deck match the reference density without reproducing its 4:3 constraints.
- Colors and tokens: petroleum black, cyan, green and copper are consistently mapped to existing project tokens and corporation state.
- Image quality and assets: menu uses an original 2736×1536 generated raster asset with the intended right-weighted composition; no original game logo or distributed artwork is reused.
- Copy/content: mode names, open-ended turn display, editor controls, victory language and God Mode audit copy reflect implemented behavior.

## Comparison history

### Pass 1 — blocked

- P1: generated industrial asset was almost invisible behind the menu treatment.
- P1: gameplay header overflow clipped the company and `END TURN` control at 1440.
- P2: fixed sidebars compressed the map into a narrow central strip.
- P2: the board was centered on the edge HQ and fell under the command deck.
- P2: Phaser created text/tween objects during every redraw, risking visual and memory degradation during long runs.

Fixes: increased source-asset visibility, compacted the ticker, moved side information to overlays, reduced the initial command-deck height, centered the authored market bounds, increased board framing, and replaced per-frame text creation with stable graphics operations.

### Pass 2 — passed

Post-fix evidence is recorded in `menu-1440-pass2.png`, `gameplay-1440-final.png`, and the two combined comparison images. No actionable P0/P1/P2 layout issue remains at 1440, 1024 or 768. Browser console was checked on a clean tab after the final renderer guard and returned no warnings or errors.

## Primary interactions tested

- Open Campaign Editor from main menu.
- Validate the default branching graph.
- Start playtest and verify Campaign mode shows an open global turn policy.
- Open Sandbox setup and start a run.
- Open God Mode, mutate cash, verify audit logging, and exercise undo.
- Verify placement cannot finish before all three buildings are placed.

## Follow-up polish

- P3: replace remaining legacy emoji in secondary briefing rows with the project's icon component.
- P3: add original executive portrait and department sprite packs when the asset-production pass expands beyond the new menu plate.

final result: passed
