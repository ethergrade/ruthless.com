# 06 — Placement & Spawn rivali

## Flusso New Game (real-map placement)

1. **New Game modal** (redesign a 2 colonne, zero-scroll):
   - Riga 1: **Archetype** (sx) + **CEO Trait** (dx).
   - Riga 2: **Starting Buildings** (sx, 3 card affiancate) + **Organization Perks** (dx).
   - Riga 3: seed / color / sim options.
   - Il player sceglie archetipo + CEO, distribuisce **fino a 8 dipartimenti su 3 edifici**
     (`initialBuildings`: 3 spec, primo = HQ, max 8 dept totali).
   - **Token budget**: 100 per Corporation Traits (cap per-trait rimosso), 20 per CEO pillars.
2. **Inizializzazione** (`initializeGameState`, `realMapPlacement = true`):
   - Il player **NON** riceve territori né edifici (li posiziona live).
   - I rivali sono creati ma **NON** ricevono tile né edifici (restano liberi).
   - `phase = 'placement'`.
3. **Placement sulla mappa**: il player clicca 3 tile libere → `placePlayerBuilding(spec)`.
   - I tile liberi brillano (glow cyan); un **ghost** building appare sul tile hoverato.
   - Ogni building ospita i dipartimenti pre-distribuiti (`initialBuildings[ i ].deptTypes`).
   - `HQ` = primo building (`isHQ: true`), conta 1 slot in più.
4. **Auto-finish al 3° building**: `placePlayerBuilding` chiama `finishPlacement()` quando
   `pendingBuildings.length >= 3`.
5. **`finishPlacement()`**:
   - Assegna territori ai rivali su tile **libere** (`assignStartingTerritories`, filtra `!controllerId`).
   - `seedCompanyBuilding` per ogni rivale (edificio HQ + dipartimenti/PROD).
   - `phase = 'playing'` → i rivali diventano visibili sulla mappa (MarketMap legge `stateRef.current.phase`).
6. **Nessun turno in placement**: `endTurn()` è no-op finché `pendingBuildings < 3`
   (ritorna `TurnResult` valido senza avanzare il turno).

## Perché questo design

- I rivali non devono occupare tile durante il placement (i loro tile restano liberi così il
  player può droppare ovunque).
- Lo spawn avviene **solo** dopo il 3° building → il giocatore vede immediatamente i competitor
  e il gioco inizia. Nessun bottone "DONE" manuale.

## Fuori da real-map placement

Se `realMapPlacement = false` (es. scenario/setup legacy), i territori sono assegnati a
`[playerCompany, ...aiCompanies]` all'init e i building sono seedati subito
(`seedPlayerBuildings` / `seedCompanyBuilding`), con `phase = 'playing'`.

## Criticità risolte

- **Bug storico**: i rivali prendevano territori all'init ma senza building, poi
  `finishPlacement` li filtrava (avevano già `controlledTiles`) → non spawnavano mai (screen
  TURN 6 senza competitor). Fix: nessun territorio rivale all'init; spawn completo in
  `finishPlacement`. (commit `2972bbd`)
- **Token oltre 100**: `adjustStat` ricalcolava il budget dal `prev` state (non dal closure
  stale) → il cap 100 è ora rispettato anche su click rapidi. (commit `8738d39`)
