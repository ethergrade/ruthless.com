# 03 — Mechanics

## Risorse aziendali (`Company`)

Ogni `Company` ha (tra gli altri):

| Campo | Note |
|-------|------|
| `cash`, `debt`, `valuation`, `revenue`, `operatingCosts`, `cashFlow` | Finanza base |
| `marketInfluence` | Alzato da **vision + network** del CEO (vedi 05-CEO-GDR) |
| `brandTrust` | Alzato da **charisma** del CEO |
| `securityPosture`, `risk` | `risk` abbassato da **resilience** del CEO |
| `innovation`, `aiCapability`, `productQuality`, `productRd`, `salesMarketing`, `consultingCapacity` | Capacità operative (0..100) |
| `executiveOrderLimit` | Azioni per turno (player: 3) |
| `controlledTiles: TileId[]` | Tile possedute |
| `buildings: Building[]`, `departments: Department[]` | Asset |
| `kind` | `'player' | 'rival' | 'startup'` |
| `ceos: CEO[]`, `ceoBuild?: CeoBuild`, `skills?: Partial<Record<CEOSkill,number>>` | CEO GDR |
| `computePoints` | Capacità non allocata generata da AI & Data / DEV; alimenta prodotti e cyber-attacchi |
| `cybersecurityPoints` | Resilienza non allocata generata da Cybersecurity; viene assegnata agli edifici |

## Compute e cybersecurity

- AI & Data genera `8 × livello × efficienza` Compute Points/turno; DEV ne genera 3.
- `allocate_compute` sposta compute su un prodotto (massimo 100): aumenta throughput fino al 50%, ma ogni punto aggiunge costo operativo.
- Con margine prodotto `≥25%` il compute assegnato cresce fino al 15%/turno; sotto il 5% decade del 10%.
- Cybersecurity genera `8 × livello × efficienza` Cybersecurity Points/turno; `security_online` aggiunge capacità tramite investimento.
- `allocate_cybersecurity` crea lo scudo del singolo edificio (massimo 100). Lo scudo viene consumato prima di firewall, compute prodotto, efficienza R&D e maturità delle idee.
- Solo quando cyber points e firewall dell'edificio arrivano entrambi a zero un attacco critico può rubare o distruggere permanentemente un'idea.
- `securityPosture` resta l'indicatore sintetico 0..100; non è una valuta spendibile.

## Dipartimenti (`Department`)

11 tipi (`DepartmentType`):

`product_rd`, `ai_data`, `cybersecurity`, `sales_marketing`, `consulting_services`,
`acquisitions`, `legal_compliance`, `people_culture`, `finance_investor`,
`corporate_strategy`, `dev_engineering`.

Ogni dipartimento ha `level`, `capacity`, `efficiency`, `morale`, `risk`, `recurringCost`,
`buildingId`. I dipartimenti abilitano azioni (`ACTION_DEFS.requiresDept`) e contribuiscono
al successo delle azioni rilevanti (`isDepartmentRelevant`).

## Edifici (`Building`)

- Ogni company ha edifici su tile. L'**HQ** è `isHQ: true` e conta 1 slot in più.
- `maxDepartments: 8` per edificio.
- `cybersecurityPoints`, `firewall`, `physicalSecurity`, `hushMoney` — resilienza e difese.
- `build_department` aggiunge dipartimenti a un edificio esistente con slot liberi.
- `build_building` costruisce un nuovo edificio su una tile libera (richiede dipartimento pertinente).

## Tile (`MarketTile`)

- `controllerId` (company che controlla), `buildingId`, `segment` (es. *open market*,
  *enterprise cluster*), `controlStrength`, `isStartupTile`, `startupPotential`, `productId`,
  `challengerId` (se contestato), `pendingAction`.
- La mappa è **infinita**: i tile sono generati proceduralmente da seed (`createMarketMap`)
  e caricati on-demand mentre la camera si sposta.
- In **placement**, i tile liberi brillano (glow cyan) come target di drop; un **ghost**
  building appare sul tile hoverato.

## Mercato

- `marketShare` = quota relativa di influenza/valore tra tutte le company.
- `MarketTrend[]`, `WeakSignal[]` — segnali macro che guidano le opportunità.
- `marketBriefing` — riepilogo ogni turno (incl. opportunità di M&A da rivali).

## Crisi / Calamità (Cataclysm)

- Se `simulation.cataclysms` è attivo, a fine turno può scattare un **cataclisma** di mercato
  che colpisce una tile posseduta (perdita di controllo, danni a edificio/dipartimenti, cash).
- La probabilità è ridotta dal **luck** del CEO del player
  (`odds = 0.12 * (1 - luck/100)`, minimo 0.04).
- `resilience` del CEO riduce il `risk` aziendale (`applyCeoPillarMods`).

## Scandali

- `scandal` (0..100) cresce su azioni fallite/illecite (es. cyver-attack che backfires,
  CEO discredit che fallisce). Alcuni perk (es. *iron_will*) o il luck mitigano l'impatto.

## Vittoria

- `computePowerScore` → `powerScore` composito (vedi 07-ALGORITHMS).
- Vittoria se `powerScore >= 70` AND `marketShare >= 0.30` AND `cash > 0`.
- `checkVictoryConditions` NON vince se il player è idle (nessun ordine): serve azione reale.
