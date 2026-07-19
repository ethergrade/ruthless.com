# 01 — Overview

## Cos'è STRATEGYLESS

STRATEGYLESS è un **gioco di strategia aziendale turn-based** ambientato in un mercato
corporativo spietato (ispirazione: *Tom Clancy's ruthless.com*, 1998). Il giocatore è
il CEO di una corporation e compete contro **rivali AI** (e startup neutrali acquisibili)
per il dominio del mercato, usando azioni di crescita, spionaggio, cyber-attacchi,
azioni legali, PR e acquisizioni ostili.

Estetica: **dark cyberpunk / neon**, mappa isometrica 3D (Phaser), UI cyan/teal,
pannelli semi-trasparenti.

## Loop di gioco

```
New Game → scegli archetipo + CEO + distribuisci 8 dipartimenti su 3 edifici
   → posizioni 3 edifici sulla mappa reale (click su tile libere)
   → al 3° edificio: SPAWN RIVALI automatico, fase 'playing'
   → loop di turni:
       - pianifichi azioni (budget + priorità) per la tua corp
       - END TURN → il motore risolve azioni player + AI, crisi, mercato, finanza
       - il mercato si muove, i rivali agiscono, emergono notizie/eventi
   → vittoria quando il tuo power score supera la soglia e controlli abbastanza mercato
```

## Risorse principali

| Risorsa | Significato |
|---------|-------------|
| **Cash** | Liquidità. Se va a 0 → bancarotta/eliminazione. |
| **Debt** | Debito (se negativo, interessi). |
| **Valuation** | Valore di mercato della corp (target di vittoria / OPA). |
| **Cash Flow** | Entrate − costi operativi per turno. |
| **Market Influence** | Capacità di muovere il mercato (alzato da vision+network CEO). |
| **Brand Trust** | Reputazione (alzato da charisma CEO). |
| **Security Posture** | Difesa cyber/fisica. |
| **Innovation / AI / Product R&D** | Capacità tecnologiche. |
| **Power Score** | Metriche composite per la vittoria (vedi 07-ALGORITHMS). |

## Vincitori / condizioni

- **Vittoria principale**: `powerScore >= 70` AND `marketShare >= 0.30` AND `cash > 0`.
- **Scenario** (tattici): controllo N tile, valuation target, market share, elimina rivale,
  sopravvivenza N turni.
- **Sconfitta**: bancarotta (cash ≤ 0 troppo a lungo) o eliminazione da un rivale.

## Controlli (mappa)

- **Drag** (o **Spazio + click**): pan della camera.
- **Wheel**: zoom.
- **Q / E**: rotazione 90°.
- **Click su tile**: seleziona / in placement posiziona un edificio.
