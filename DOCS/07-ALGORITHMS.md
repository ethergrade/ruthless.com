# 07 — Algorithms

## Power Score (`computePowerScore`)

Metriche composite per la vittoria. Pesi (sul `power` 0..100):

| Componente | Peso | Fonte |
|-----------|------|-------|
| `shareRel` (market share relativa) | 40 | quota di mercato della company / totale |
| `valuation` | 18 | log/scale della valutazione |
| `ceoScore` | 12 | vedi sotto (analytics pesato 2×) |
| `trend` | 10 | allineamento ai trend di mercato |
| `weak` | 8 | exploit dei weak signals |
| `trust/sec` | 10 | brandTrust + security medie |
| `cash` | 2 | liquidità |

`ceoScore` (0..1):
```
analytics = ceo?.skills?.analytics ?? 0
baseSum  = somma degli 8 pillar
ceoScore = (baseSum + analytics) / ((8 + 1) * 10)   // analytics conta DOPPIO
```
Poi `power += ceoScore * 12`.

**Vittoria**: `powerScore >= 70` AND `shareRel >= 0.30` AND `cash > 0`.
`checkVictoryConditions` NON vince se il player è idle (nessun ordine reale quel turno).

## Success Chance (`estimateSuccess` / `resolveAction`)

Base `0.7`, modificata da:

```
+ (relevantDept.level - 1) * 0.05        // dipartimento pertinente più alto = meglio
+ (relevantDept.efficiency - 0.5) * 0.2
+ tilt.combat   * 0.05                    // profilo strategico (offesa/difesa/crescita)
+ tilt.defense  * 0.05
+ tilt.growth   * 0.05
- avgRivalStrength / 2 * k                // rivali forti abbassano il successo offensivo
+ luck / 100                             // LUCK ampliato: +fino a +0.10
```
Clamp finale: `max(0.05, min(0.97, round(chance*100)/100))`.

Per `cyber_attack`, la probabilità mostra anche firewall e Cybersecurity Points del building bersaglio; i Compute Points impegnati aumentano l'offesa. Dopo il roll, il resolver confronta:

```
offense = compute*2 + aiCapability*.35 + livelli cyber/AI*3
defense = firewall*.5 + cyberPoints + securityPosture*.25
```

Lo scudo cyber assorbe il danno per primo. A difesa completamente azzerata l'RNG deterministico sceglie fra furto e distruzione permanente dell'idea esposta.

`strategyTilt(companyId)` misura come gioca il player (tilt offesa/difesa/crescita) dalla
allocazione di budget delle azioni.

## Mappa infinita (`createMarketMap` + `MarketMap`)

- `createMarketMap(rng, w, h, mapSeed)`: genera i tile **deterministicamente** dal seed
  (stessa seed → stessa mappa). Ogni tile ha `segment`, `isStartupTile`, `startupPotential`.
- **Viewport culling**: `MarketMap.drawWorld` itera solo i tile nel range visibile
  (`gxMin..gxMax`, `gyMin..gyMax`) calcolato proiettando i 4 angoli dello schermo
  (fix del "canvas vuoto" — prima usava solo 2 angoli e tagliava metà mappa).
- **`tileToWorld(gx, gy)`**: proiezione isometrica O(1):
  `x = (gx - gy) * 48`, `y = (gx + gy) * 24` (TILE_W=96, H=48).
- **`screenToTile`**: inverso O(1) per il picking.
- **Caricamento on-demand**: `explore(cx, cy, radius)` nello store genera i tile attorno
  alla camera mentre pans (mappa "infinita").
- **Camera HQ**: dopo `endTurn`, la camera centra l'HQ del player (`cam.centerOn`).

## RNG (`createRNG`)

RNG seedato (mulberry32 / xorshift-like) → partite deterministiche con stesso seed.
Usato per: generazione mappa, assegnazione territori (`shuffle`), eventi, catch% spionaggio.

## Cataclysm odds

```
odds = 0.12 * (1 - luck/100)   // clamp minimo 0.04
```
Se scatta, colpisce una tile posseduta (perdita controllo, danni edificio/dipartimenti, cash).

## Formattazione

`src/utils/formatters.ts`: numeri in formato europeo (`.__.__,__`), es. `2.1M`, `€401.765`.
