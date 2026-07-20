# DOCS — ruthless.com / STRATEGYLESS

Documentazione completa del progetto **ruthless.com** (nome in-game: **STRATEGYLESS**),
un gioco di strategia aziendale turn-based ispirato a *Tom Clancy's ruthless.com*.

> Stack: TypeScript + React + Vite + Phaser (mappa isometrica) + Zustand (stato di gioco)
> + Vitest (test). Deploy: GitHub Pages via `.github/workflows/deploy.yml` (base `./`).

## Indice

| File | Argomento |
|------|-----------|
| [01-OVERVIEW.md](./01-OVERVIEW.md) | Cos'è il gioco, tone, loop di gioco, obiettivi |
| [02-ARCHITECTURE.md](./02-ARCHITECTURE.md) | Stack, struttura cartelle, flussi dati, ciclo di turno |
| [03-MECHANICS.md](./03-MECHANICS.md) | Risorse, dipartimenti, edifici, tile, mercato, crisi |
| [04-ACTIONS.md](./04-ACTIONS.md) | Catalogo completo delle azioni (`ActionType`) |
| [05-CEO-GDR.md](./05-CEO-GDR.md) | CEO GDR: 8 Executive Pillars + point-buy |
| [06-PLACEMENT-SPAWN.md](./06-PLACEMENT-SPAWN.md) | New Game, placement reale, spawn rivali |
| [07-ALGORITHMS.md](./07-ALGORITHMS.md) | Power score, success chance, mappa infinita, RNG |
| [08-CRITICITA.md](./08-CRITICITA.md) | Criticità, debiti tecnici, bug risolti |

## Stato attuale (snapshot 2026-07-20)

- Verified green: `npm run lint` · `npm test` (65 test) · `npm run build`.
- Meccaniche implementate: risorse aziendali, 11 dipartimenti, edifici + HQ, mappa infinita
  procedurale, ~45 azioni, CEO GDR a 8 pillar, crisi/calamità, vittoria per power score,
  placement reale su mappa con spawn rivali automatico al 3° building, Compute Grid con
  generazione/allocazione/edge competitivo, acquisizioni complete con shock M&A, trend e
  weak signal vincolanti per il prodotto, spionaggio differito con exploit/re-patent/lawsuit.
