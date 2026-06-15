# Cap a 1 punto per i pronostici salvati dopo il calcio d'inizio

Un Pronostico di Girone la cui ultima modifica (`prediction.updated_at`) è **successiva al calcio d'inizio** (`match.kickoff`) della Partita vale in Classifica **al massimo 1 punto**: anche col punteggio esatto non prende i 3 punti pieni, viene cappato a 1 (l'esatto implica sempre l'esito corretto, quindi resta 1, mai 0).

Il flag è derivato a runtime (`GroupDiff.late = updatedAt > kickoff`, confronto sugli istanti UTC), applicato in `scoreDiffs` (`src/lib/tournament/compare.ts`). Nessuna colonna nuova, nessun dato di stato: coerente con [ADR 0001](0001-derive-standings-and-bracket-at-runtime.md).

## Perché

All'avvio del concorso non esisteva ancora il blocco di validazione sul `kickoff`: alcuni utenti iscritti a torneo già iniziato hanno inserito pronostici su partite **già giocate**, conoscendone il risultato — vantaggio sleale che falsava la Classifica Gironi. È la "Questione aperta — equità dei nuovi iscritti" lasciata in sospeso da [ADR 0003](0003-two-phase-format-with-foresight-bonus.md): questo ADR la chiude per la Fase 1 (Gironi).

Il cap a 1 (invece dell'azzeramento a 0) è una scelta di proporzionalità: chi pronostica a partita iniziata ha comunque dimostrato di voler partecipare e l'esito 1/X/2 a risultato noto è un'informazione banale che non merita di essere punita oltre il valore minimo. Quello che si toglie è il **premio alla preveggenza** del punteggio esatto, che a risultato noto sarebbe copiato.

La regola è **retroattiva e automatica**: essendo un confronto live a ogni render, vale per gli inserimenti tardivi già presenti e per qualsiasi futura iscrizione a torneo iniziato, senza interventi manuali sul DB. Sui dati attuali tocca 37 pronostici esatti-late di 13 utenti (−74 punti totali); i pronostici tardivi a solo-esito o sbagliati restano invariati.

## Conseguenza

- Il confronto richiede che il Pronostico porti con sé `updatedAt` (ISO UTC): aggiunto come campo **opzionale** a `Prediction` / `LeaderboardPrediction` e popolato dalle query (`loadPredictions`, `loadLeaderboard`). Assente → mai `late` (è il caso degli stati ottimistici lato client, che riguardano solo match non ancora bloccati).
- Coerenza UTC: sia `kickoff` sia `updated_at` sono `timestamp without time zone` scritti dal runtime (Vercel/Supabase, sessione UTC) come UTC-wall, quindi confrontabili senza sfasamenti. Lo scarto di fuso si manifesta solo leggendo il DB da una sessione non-UTC (es. dev locale `Europe/Rome`) e non influisce sul calcolo a runtime.
- Il cap agisce **solo** sui punti della Classifica (`scoreDiffs`). La voce "Differenza" (`summarize`, compare-tab) resta numerica e continua a segnalare il punteggio esatto: è una misura di vicinanza al risultato, non di punteggio.
