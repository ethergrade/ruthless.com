# 04 — Actions (catalogo)

Tutte le azioni sono `ActionType` (enum in `types/index.ts`). Ogni azione ha
`budget` (cash speso) e `priority`. La risoluzione avviene in `TurnEngine.resolveAction`
(switch su `action.type`). `estimateSuccess` prevede la probabilità (0..1) per l'UI.

## Crescita / operations

| Azione | Effetto |
|--------|---------|
| `build_department` | Aggiunge un dipartimento a un edificio con slot liberi |
| `build_building` | Nuovo edificio su tile libera (richiede dipartimento pertinente) |
| `department_initiative` | Esegue l'ordine strategico del reparto selezionato; probabilità ed effetti dipendono da livello, efficienza, morale, rischio e budget |
| `launch_product` | Lancia un prodotto; idea, trend sfruttato o weak signal finanziato ne vincolano categoria e settore |
| `improve_product` | Migliora un prodotto esistente |
| `generate_compute` | Espande il Compute Grid: riserva immediata, più generazione futura e upkeep persistente |
| `allocate_compute` | Assegna Compute Points a un prodotto; rendimento e crescita dipendono dal margine |
| `expand_market` | Espande la quota di mercato |
| `marketing_campaign` | Campagna marketing (+brand trust/awareness) |
| `hire_executive` | Assume un executive |
| `hire_ceo` / `hire_coo` | Assegna CEO/COO a un HQ (richiede HR dept) |
| `security_hardening` | Alza difese fisiche |
| `ai_automation` | Automatizza (↓ costi, ↑ AI) |
| `launch_consulting_practice` | Pratica di consulenza |
| `reduce_costs` | Taglia costi (possibile morale ↓) |
| `mass_layoff` | Licenziamento di massa: ↓ costi ma ↓ morale/brand |
| `raise_capital` | Raccolta capitale (+cash) |
| `pivot_product` | Cambia scope prodotto → nuovo push di versione |
| `create_ideas` | R&D: inventa una tech/idea (brevità → trend) |
| `release_source` | Open-source idea: +awareness/trust, può maturare un weak signal |
| `sell_source` | Vende source code a un rivale: +cash, flip ownership trend |

## Department Initiatives

Ogni reparto posseduto espone un ordine dedicato tramite `department_initiative`.
Il costo minimo è $200k; budget aggiuntivo aumenta probabilità e intensità fino a un cap.
Lo stesso reparto può eseguire una sola initiative per turno. Un fallimento consuma il 35%
del budget e applica il backfire specifico, oltre a essere registrato nel news feed.

| Reparto | Ordine | Upside | Rischio / conseguenza negativa |
|---------|--------|--------|--------------------------------|
| Product R&D | Moonshot Product Sprint | innovazione, qualità e market fit | crunch, morale, rischio e debito tecnico |
| AI & Data | Compute Surge | Compute Points, Compute Grid, AI capability | burn di compute, pressione e perdita AI |
| Cybersecurity | Zero-Day Readiness Drill | cyber reserve, security posture, trust | esposizione pubblica, perdita difese e morale |
| Sales & Marketing | Category Blitz | brand, adozione, market fit e market share | brand fatigue e perdita clienti |
| Consulting Services | Transformation War Room | capacity, fee income, trust e product fit | over-utilization e danno reputazionale |
| Acquisitions | Deal Pipeline Offensive | credibilità, innovazione e portfolio fit | integration anxiety, scandal e debito |
| Legal & Compliance | Patent Fortress | Legal Points, trust e qualità percepita | compliance exposure e scandalo |
| People & Culture | Culture Reset | morale, employer brand e recupero dei team | training slowdown o iniziativa percepita come vuota |
| Finance & Investor | Investor Roadshow | liquidità e investor trust | maggiore leva, pressione interna e rischio credito |
| Corporate Strategy | Portfolio Reorganization | brand, innovazione e fit di portafoglio | confusione strategica e morale in calo |
| DEV Engineering | Platform Rewrite | scalabilità, qualità, compute e debito tecnico ridotto | outage, compute perso e nuovo debito tecnico |

La chance usa:

```
0.45 + level + efficiency + departmentMorale - departmentRisk
     + companyMorale + budgetConfidence
```

Il resolver applica clamp a tutte le metriche e usa il prodotto collegato al reparto
quando l'ordine è tecnico; Sales, Consulting, Legal e Strategy operano sul portfolio.

## M&A

| Azione | Effetto |
|--------|---------|
| `scout_acquisition` | Esplora opportunità di acquisizione |
| `acquire_company` | Acquisisce una corp (soglia: startup 60% / rival 80% del valore), trasferisce tutti gli edifici con reparti/prodotti e genera uno shock M&A positivo o negativo |
| `acquire_below_value` | Compra un rivale sotto valutazione (richiede Finance) |
| `public_tender_offer` | OPA pubblica su edificio/company rivale |

## Guerra corporativa (ruthless.com-inspired)

| Azione | Effetto |
|--------|---------|
| `industrial_espionage` | Infiltra un reparto rivale e mette al sicuro un dossier (Compute, Cybersecurity, R&D, idea o blueprint) utilizzabile dal turno successivo |
| `exploit_stolen_asset` | Converte un dossier pronto in punti Compute/Cybersecurity, capacità R&D o un'idea derivata con provenienza rubata |
| `repatent_stolen_asset` | Legal-only: protegge esclusivamente idee e blueprint ottenuti con spionaggio; non si applica a punti o R&D generico |
| `cyber_attack` | Hack rivale: data run / virus / breach |
| `allocate_cybersecurity` | Assegna Cybersecurity Points a un proprio edificio |
| `security_offline` | Sicurezza fisica: guardie, lockdown, difesa da sabotaggio |
| `sabotage_building` | Sabotaggio fisico: incendia un edificio rivale |
| `defend_tile` | Rinforza firewall + sicurezza fisica di un proprio tile |
| `security_online` | Difesa cyber: genera capacità, rinforza firewall, sweep e password |
| `legal_action` | Causa / brevetto / disputa |
| `legal_sue` | Causa vs rivale (danni + colpo di valutazione) |
| `legal_patent` | Blocca una categoria tech a un rivale |
| `legal_subpoena` | Citazione dati rivale (intel + pressione compliance) |
| `ceo_social` | Post social del CEO: tone + autenticità |
| `auction_sell` | Mette un asset all'asta aperta |
| `auction_bid` | Offerta su una listing esistente |

## CEO GDR / PR

| Azione | Effetto |
|--------|---------|
| `ceo_praise` | CEO elogia pubblicamente un rivale (nudge diplomatico di mercato) |
| `ceo_discredit` | CEO scredita un rivale → muove il mercato (↓ reputazione rivale) |
| `train_ceo` | Addestra un pillar esecutivo (budget / special points) |
| `fire_ceo` | Rimuove il CEO (libera HQ, −1 ordine) |

## Note

- Molte azioni richiedono un dipartimento pertinente (`ACTION_DEFS.requiresDept`) — se manca,
  l'azione è **lockata** nell'UI.
- `end_turn` è un'azione di controllo (non un'azione di mercato).
- `resolveAction` applica gli effetti dentro `applyActionEffectsToCompany`; le azioni fallite
  generano notizie negative e possono alzare `scandal`.
