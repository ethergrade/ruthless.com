# 05 — CEO GDR (Executive Pillars)

Il CEO non è più un clone di Fallout S.P.E.C.I.A.L.: usa **8 Executive Pillars** coerenti
col tema corporate. Ogni pillar guida **meccaniche globali** del gioco (non solo bonus azione).

## I 8 pillar (`CEOSkill`)

| Pillar | Impatto globale (via `applyCeoPillarMods`) |
|--------|---------------------------------------------|
| `vision` | + `marketInfluence` (con `network`) |
| `network` | + `marketInfluence` (con `vision`) |
| `analytics` | pesato **2×** nel `ceoScore` → power score |
| `charisma` | + `brandTrust` |
| `strategy` | ↓ `operatingCosts` (con `operations`) |
| `operations` | ↓ `operatingCosts` (con `strategy`) |
| `resilience` | ↓ `risk` (crisi) |
| `luck` | + prob. successo azioni, − prob. cataclisma |

`CEO_PILLARS` = `['vision','network','analytics','charisma','strategy','operations','resilience','luck']`.
`PILLAR_LABELS` = etichette UI.

## Point-buy (New Game)

- **Corporation Traits**: budget 100 token (cap per-trait rimosso — solo il pool totale).
  Ogni stat 0..100 (`adjustStat` clamp `Math.min(100, cur+delta)`, minimo −20).
- **CEO Character Build**: budget 20 token su 8 pillar (`CEO_TOKEN_BUDGET = 20`).
- `specialPoints` del CEO derivano da **operations**: `1 + floor(operations/4)`.

## Mappatura azione → pillar (`ACTION_PILLAR`)

Ogni azione ha un pillar associato (bonus quando il CEO ha quel pillar alto):
cyber/espionage → `network`, build → `strategy`, R&D/legal/raise_capital → `analytics`,
PR/acquire/hire → `charisma`, train_ceo/expand_market → `resilience`, scout_acquisition → `vision`.

## Perk (`PERK_PILLAR_THRESHOLD`)

I perk si sbloccano superando soglie di pillar:
`corporate_intelligence` → `analytics`, `talent_magnet` → `resilience`,
`cost_cutter` / `high_leverage` → `strategy`.

## `applyCeoPillarMods(company)` — chiamato in `endTurn`

```
marketInfluence += (vision + network) * 0.6        // cap 100
brandTrust      += charisma * 0.4                   // cap 100
operatingCosts  *= clamp(1 - (strategy+operations)*0.02, 0.65, 1)  // −35% max
risk             = max(0, min(1, risk - resilience*0.01))
```

Poi `computePowerScore` pesa `analytics` **2×** dentro il `ceoScore`.

## Luck (ampliato)

- `estimateSuccess` / `resolveAction`: `+ luck/100` alla probabilità di successo di OGNI azione.
- Cataclysm: `odds = 0.12 * (1 - luck/100)` (min 0.04) — il luck riduce le crisi di mercato.
- `industrial_espionage`: `caught%` ridotto da `luck` (`0.15 + luck*0.03`).
