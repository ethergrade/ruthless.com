# 08 — Criticità & debiti tecnici

Documentate qui le criticità note, i bug risolti e i debiti tecnici (storico dal 2026-07).

## Bug risolti (cronologico)

| Commit | Problema | Fix |
|--------|----------|-----|
| `07564a6` | Cap per-trait a 30 bloccava ogni stat oltre 30 | Rimosso cap per-trait; solo pool 100 token |
| `b20a0df` | Rivali non disegnati dopo finishPlacement | `stateRef` live + creazione scena una volta (render legge `stateRef.current`) |
| `3d82e12` | Canvas vuoto / metà mappa tagliata | Culling su 4 angoli anziché 2 |
| `5886fa1` | `build_department` non funzionava | Dropdown edifici con slot liberi; HQ = 1 slot in più; cap 8 |
| `723665b` | Non si vedeva dove posizionare | Glow tile libere + ghost building su hover |
| `1f5b0f5` | Camera non centra HQ | `tileToWorld` + `cam.centerOn(HQ)` dopo end turn |
| `8738d39` | Token oltre 100 spesi | `adjustStat` ricalcola da `prev` (non closure stale) |
| `f77e034` | News feed mostra `company_4` | `NewsPanel` risolve `companyId` → nome reale (store) |
| `2972bbd` | Rivali non spawnano (TURN 6 senza competitor) | Nessun territorio rivale all'init; spawn completo in `finishPlacement`; `endTurn` no-op in placement; `Company.kind` scritto/tipizzato |

## Criticità attive / debiti

1. **Browser automation instabile** in QA: `click`/`snapshot` a volte ritornano `about:blank`.
   Verifica visiva fatta via `browser_vision` o probe headless (vitest).
2. **Modal New Game**: risolto con redesign a 2 colonne (zero-scroll). Se serve ancora meno
   altezza, si possono rendere le sezioni collassabili.
3. **Effetti 2D / three.js**: niente three.js; glow/neon via Phaser graphics. Effetti particle
   posticipati (debito minore).
4. **T7 tuning**: playtest/equilibrio azioni non ancora bilanciato finemente.
5. **`resolveAction` switch enorme** (`turnEngine.ts` ~2700 righe): il motore è un "god class".
   Refactor in moduli (azione-per-file) sarebbe opportuno ma non urgente.
6. **Mappa infinita + performance**: culling OK; se si esplorano troppe tile, la Map cresce.
   Non c'è ancora un limite di memoria/cache LRU sui tile fuori viewport.
7. **Test**: 13 test ufficiali + probe temporanei (rimossi dopo il pass). Copertura su
   `applyCeoPillarMods`, spawn rivali, token budget, placement — ma non su tutte le ~45 azioni.

## Convenzioni di sviluppo (dal progetto)

- Prima di commit: `npx tsc --noEmit` → `npm run lint` → `npx vitest run` → `npm run build` (green).
- No push senza OK utente (autorizzato per i batch recenti).
- Testi UI in inglese; summary/comms in italiano.
- Numeri europei (`__.__,__`).
- Patch piccoli (<8K token) per evitare timeout di stream.
- Verifica meccaniche a livello engine (probe headless) prima di toccare React.
