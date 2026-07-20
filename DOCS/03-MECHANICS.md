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
| `computePoints` | Riserva non allocata generata da AI & Data / DEV; alimenta prodotti e cyber-attacchi |
| `computeInfrastructure` | Compute Grid 0..100: moltiplicatore persistente della generazione rinnovabile |
| `cybersecurityPoints` | Resilienza non allocata generata da Cybersecurity; viene assegnata agli edifici |

## Compute e cybersecurity

- Una company appena creata riceve **20 Compute Points di commissioning per ogni AI & Data iniziale**. Non è una rendita: è la riserva con cui iniziare ad allocare capacità. Acquisizioni e spionaggio possono trasferire altro compute nella riserva.
- AI & Data genera `8 × livello × efficienza` Compute Points/turno; DEV integra con `3 × livello × efficienza`. Un dipartimento interrotto non genera.
- `generate_compute` (**Expand Compute Grid**) investe almeno $200k: aggiunge punti immediati e livelli persistenti di infrastruttura. Il livello 100 raddoppia la generazione dipartimentale; i ritorni dell'upgrade diminuiscono e ogni livello costa $1.500/turno.
- `allocate_compute` sposta compute su un prodotto (massimo 100): aumenta throughput fino al 50%, ma ogni punto aggiunge $1.000/turno di costo operativo.
- Se il prodotto ha più compute dei rivali nella stessa categoria e negli stessi segmenti, ottiene inoltre fino al 20% di bonus ricavi competitivo. Il bonus non penalizza chi è indietro e si somma moltiplicativamente al throughput.
- Con margine prodotto `≥25%` il compute assegnato cresce fino al 15%/turno; sotto il 5% decade del 10%.
- La riserva non allocata ha cap 500 e può anche essere consumata da `cyber_attack`; il compute assegnato a un prodotto resta separato.
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

`department_initiative` rende operativi tutti gli 11 tipi: il giocatore seleziona un
reparto reale, vede prima upside e backfire e impegna budget. Morale alto ed efficienza
alzano la chance; rischio e morale aziendale basso la riducono. Gli esiti muovono in modo
persistente morale aziendale/reparto, brand (quindi market influence/share), adozione e
market fit, compute/grid, liquidità/debito, difese e capacità specialistiche. Il reparto
entra in cooldown fino al turno successivo.

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
- `EXPLOIT` su un trend e `INVEST` su un weak signal aprono `Launch Product` vincolando
  categoria e settore all'opportunità scelta; il picker mostra solo idee R&D compatibili.
- Un'acquisizione completata assorbe la company target e trasferisce tile, edifici e relativi
  reparti/prodotti al compratore, rimuovendo il precedente proprietario dai competitor.
  Il premio pagato, la qualità del target, la redditività e l'archetipo del compratore determinano
  la probabilità di uno shock M&A positivo o negativo su domanda, valutazione e influenza.

## Catena Industrial Espionage

- Un ordine riuscito non clona più immediatamente un prodotto: genera un dossier persistente
  con vittima, reparto, asset sorgente e valore, disponibile dal turno seguente per 6 turni.
- `Exploit Stolen Asset` trasferisce punti Compute/Cybersecurity, aumenta R&D oppure crea
  un'idea reverse-engineered per idee e blueprint di prodotto rubati.
- Idee e prodotti derivati mantengono la provenienza. Quando un prodotto simile viene lanciato,
  l'azienda originale può intentare una causa e ottenere danni, perdita di trust e market fit.
- `Re-Patent Stolen IP` richiede Legal & Compliance e protegge solo dossier `idea` o
  `product_blueprint`; la protezione segue l'idea e il prodotto derivato e blocca la causa.

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
