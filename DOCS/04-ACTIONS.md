# 04 — Actions (catalogo)

Tutte le azioni sono `ActionType` (enum in `types/index.ts`). Ogni azione ha
`budget` (cash speso) e `priority`. La risoluzione avviene in `TurnEngine.resolveAction`
(switch su `action.type`). `estimateSuccess` prevede la probabilità (0..1) per l'UI.

## Crescita / operations

| Azione | Effetto |
|--------|---------|
| `build_department` | Aggiunge un dipartimento a un edificio con slot liberi |
| `build_building` | Nuovo edificio su tile libera (richiede dipartimento pertinente) |
| `launch_product` | Lancia un prodotto; idea, trend sfruttato o weak signal finanziato ne vincolano categoria e settore |
| `improve_product` | Migliora un prodotto esistente |
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
