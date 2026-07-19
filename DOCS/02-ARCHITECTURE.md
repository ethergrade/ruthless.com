# 02 — Architecture

## Stack

| Livello | Tecnologia |
|---------|-----------|
| Linguaggio | TypeScript (strict) |
| UI | React 18 + Vite |
| Mappa | Phaser 3 (scena isometrica, canvas WebGL/Canvas) |
| Stato | Zustand (`src/store/gameStore.ts`) — engine + state specchio |
| Test | Vitest |
| Audio | Web Audio API (`src/audio/AudioEngine.ts`) |
| Deploy | GitHub Pages (`.github/workflows/deploy.yml`, base `./`) |

## Struttura cartelle

```
src/
  types/index.ts            # tutte le interfacce (Company, MarketTile, Building,
                            # Department, TurnAction, NewsItem, ScenarioConfig, ...)
  data/
    archetypes.ts           # CEO_PILLARS, PILLAR_LABELS, ACTION_PILLAR, PERK_PILLAR_THRESHOLD,
                            # ARCHETYPES, CEO_TRAIT_DEFS, ARCHETYPE_PERKS, STAT_LABELS
    technologies.ts         # alberi tech / DEV_SKILLS
    generators.ts           # nomi company, descrizioni
    editorsData.ts          # dati editor di scenario
  simulation/
    turn/turnEngine.ts      # MOTORE: init, endTurn, resolveAction, computePowerScore,
                            # applyCeoPillarMods, estimateSuccess, crisi, spawn rivali
    factories/
      companyFactory.ts     # createCompany (player/rival/startup), colori, CEO, dipartimenti
      marketFactory.ts      # createMarketMap (mappa infinita deterministica)
    utils/
      rng.ts                # RNG seedato (createRNG)
      ids.ts                # generatori di id (company/building/department/tile)
    phase3.test.ts, turnEngine.test.ts, layout.test.tsx  # test
  store/gameStore.ts        # Zustand: state, engine, azioni (initializeGame, placeBuilding,
                            # finishPlacement, endTurn, ...)
  app/components/
    layout/  MainMenu, Header, Sidebar, RightSidebar, BottomPanel, SettingsModal, editors
    map/     MarketMap (scena Phaser, drawWorld, targeting, camera)
    actions/ ActionComposer
    ui/      Modal, Icon, NotificationToast
  audio/AudioEngine.ts
  utils/formatters.ts       # formattazione numeri (europei: .__.__,__)
App.tsx                      # wiring: stato → componenti, handler tile/placement/endturn
main.tsx
```

## Flusso dati

```
App.tsx
  └─ useGameStore()  →  state (GameState) + engine (TurnEngine)
        │
        ├─ initializeGame(seed, ceoTrait, scenario, statOverrides, ceoBuild,
        │                  initialBuildings, realMapPlacement, mapSeed)
        │      └─ new TurnEngine(...).initializeGameState()
        │
        ├─ placeBuilding(spec)  → engine.placePlayerBuilding(spec)  [solo in placement]
        │      └─ al 3° building → engine.finishPlacement()  [spawn rivali + phase 'playing']
        │
        ├─ endTurn()  → engine.endTurn()  [risolve tutto il turno]
        │      └─ state nuovo → Zustand set()
        │
        └─ componenti leggono state:
             - Header: KPI (cash, flow, valuation, influence, trust, security, progress)
             - MarketMap: tile/building/rivali (legge stateRef live)
             - BottomPanel / RightSidebar: azioni, news, trend, CEO
```

## Ciclo di turno (`endTurn`)

Ordine di risoluzione dentro `TurnEngine.endTurn()`:

1. `processPlayerActions` — risolve le azioni del player (`resolveAction` per ciascuna).
2. `processAIActions` — le AI pianificano ed eseguono azioni.
3. `resolveAuctions` — case d'asta (vendite/acquisti di asset).
4. `resolveMarket` — prezzi, quote di mercato, treni.
5. `resolveFinancials` — cash flow, debito, interessi.
6. `resolveRisks` — eventi negativi (scandali, breach).
7. `autoAggression` — le AI possono attaccare se minacciate.
8. `applySharkMarket` — evento di mercato casuale.
9. `applyGlobalEvents` — cataclismi (se abilitati), eventi macro.
10. `recalculateCompanyMetrics` — ricalcolo metriche per ogni company.
11. `generateMarketBriefing` / `refreshTrends` / `advanceProductLifecycles`.
12. `applyCeoPillarMods` — applica i modificatori globali dei pillar CEO.
13. `computePowerScore` — calcola il power score (vittoria).
14. `checkVictoryConditions` — vittoria / sconfitta.

## Note di design

- **Mappa infinita**: `createMarketMap` genera tile proceduralmente da seed; il viewport
  fa culling e `screenToTile` è O(1) (proiezione 4 angoli). I tile sono caricati on-demand
  (`explore()` nello store) mentre la camera pans.
- **Stato specchio**: Zustand mantiene una copia di `GameState`; `MarketMap` legge
  `stateRef.current` (ref live) così la scena Phaser non va ricreata a ogni turno — i rivali
  appaiono non appena `phase` diventa `'playing'`.
- **Nessun three.js**: effetti 2D/neon solo via Phaser graphics.
