# Formato a due fasi con Bonus di preveggenza set-based

Il concorso non è più una fase unica (gironi + tabellone derivato dai propri pronostici). È diviso in due serie di pronostici, con quattro classifiche.

- **Fase 1** — all'inizio l'utente compila tutti i Gironi e l'intero Tabellone previsto (R32→Finale) in un colpo, partendo dalle proprie Classifiche. Si **congela al primo calcio d'inizio del torneo**.
- **Fase 2** — pronostici sul Tabellone reale, **rolling**: a Gironi finiti si pronosticano gli accoppiamenti reali dei sedicesimi; a sedicesimi finiti gli ottavi reali; e così via fino a Finale + Finale 3°/4°. Ogni finestra si apre quando il turno precedente è finito e sincronizzato, e si blocca tutta insieme al primo calcio d'inizio del turno.

Quattro classifiche, sempre visibili separatamente: **Gironi** (punti dai pronostici dei gironi), **Tabellone** (punti di Fase 2), **Bonus** (preveggenza di Fase 1), **Totale** = somma grezza delle tre.

### Punteggi

- **Gironi**: invariato — esatto 3, solo esito 1/X/2 1 (vedi `compare.ts` `POINTS`).
- **Tabellone (Fase 2)**, per partita: punteggio esatto = 3, "chi-passa" (squadra avanzante giusta, inclusi supplementari/rigori) = 1, cumulabili → max 4. L'"esatto" si confronta col **punteggio finale prima dei rigori** (include i supplementari).
- **Bonus (Fase 1)**: per ogni squadra che il Tabellone previsto in Fase 1 dava a un certo turno e che lo raggiunge davvero nel Tabellone reale. Conteggio **per squadra×turno**, cumulativo lungo i turni, peso crescente: R32=1, R16=2, QF=3, SF=5, Finale=8, Campione=13. È set-based (insiemi di squadre per turno), **non** sugli accoppiamenti. Riusa `teamsReachingStage` + `roundSetDiffs`. La Finale 3°/4° non genera Bonus a sé (i due team sono già contati alle Semifinali).

## Perché

La fase unica era fragilissima: i pronostici a eliminazione di Fase 1 si appoggiano al _proprio_ tabellone derivato, quindi dagli ottavi in poi è quasi impossibile che un utente abbia previsto partite che si giocano davvero. Confrontarli partita-per-partita coi risultati reali dava quasi sempre zero (vedi ADR 0001 / `roundSetDiffs`, che per questo confronta _insiemi_ di squadre per turno, non accoppiamenti).

Separare in due fasi rende la Fase 2 sempre azzeccabile (si pronostica sulle squadre vere di quel turno) e trasforma il valore della preveggenza iniziale in un premio dedicato, il Bonus, invece di buttarlo via.

Il Bonus resta **set-based** di proposito, anche se l'idea iniziale era "un bonus per ogni partita azzeccata": premiare gli _accoppiamenti_ esatti previsti alla cieca sarebbe di nuovo fragilissimo (rarissimo azzeccare entrambe le squadre nello slot giusto). Premiare "questa squadra che avevo dato in semifinale c'è arrivata davvero" è realizzabile e mantiene la coerenza con la regola D11 / la voce "Differenza" del glossario.

Il **lock di Fase 1 al via del torneo** serve all'equità del Bonus: se il bracket di Fase 1 fosse modificabile dopo aver visto i risultati reali, il Bonus non premierebbe più alcuna preveggenza. Si è scartato il lock "al via dei sedicesimi reali" perché avrebbe reso il Bonus R32 gratuito (set noto) e duplicato l'intuito della Fase 2.

Il modello dati aggiunge una colonna **`phase`** alla chiave primaria di `prediction` — `(userId, matchId, phase)` — così una partita knockout può avere sia il pronostico del bracket previsto (phase 1) sia quello sugli accoppiamenti reali (phase 2). Resta solo input grezzo: **ADR 0001 intatto**.

## Conseguenza

- Migrazione: `prediction` passa a PK `(userId, matchId, phase)`; le righe esistenti diventano `phase = 1`.
- `real_result` deve memorizzare, per il knockout, **chi è avanzato** (oggi assente) per il punto "chi-passa".
- La dashboard espone due fasi di compilazione e quattro viste di classifica (Gironi / Tabellone / Bonus / Totale).
- Tie-break del Totale: punti totali → esatti totali → nome.

### Questione aperta — equità dei nuovi iscritti

Un utente che si iscrive a torneo già iniziato deve poter compilare tutta la Fase 1, ma lo farebbe **conoscendo già alcuni risultati reali** — vantaggio sleale sia sui Gironi sia sul Bonus. Per ora: chi ha già inserito i pronostici è congelato fino alla finale; il trattamento equo dei nuovi iscritti è **rinviato** e va deciso prima di considerare il formato definitivo.
