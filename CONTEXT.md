# Mondiali — Pronostici Coppa del Mondo 2026

App di pronostici personali per la Coppa del Mondo maschile FIFA 2026 (48 squadre). Ogni utente compila i propri pronostici e li confronta con i risultati reali.

## Language

**Pronostico**:
La previsione di un singolo utente sul risultato di una Partita. Personale e privato: non condiviso né messo in competizione con altri utenti.
_Avoid_: Predizione, scommessa, bet

**Partita**:
Un singolo incontro del torneo, di Girone o a eliminazione (knockout).
_Avoid_: Match, gara, fixture

**Girone**:
Uno dei 12 gruppi da 4 squadre della fase iniziale. Produce una Classifica.
_Avoid_: Gruppo, pool

**Classifica**:
L'ordinamento delle squadre dentro un Girone, derivato dai Pronostici dell'utente secondo i criteri di tie-break FIFA.
_Avoid_: Standings, ranking

**Tabellone**:
La struttura a eliminazione diretta dal Round of 32 alla finale. Gli slot sono fissi per _posizione_ (es. "1ª del Girone A"), secondo lo schema ufficiale FIFA.
_Avoid_: Bracket, albero, knockout stage

**Risultato reale**:
Il punteggio effettivo di una Partita giocata, scaricato da fonte esterna (football-data.org). Esiste solo per partite già disputate.
_Avoid_: Score, esito

**Sync**:
L'azione manuale (a pulsante) di scaricare i Risultati reali e confrontarli con i Pronostici dell'utente, evidenziando le Differenze.
_Avoid_: Refresh, fetch, aggiornamento

**Differenza**:
Lo scarto tra Pronostico e Risultato reale, evidenziato dopo un Sync su due livelli: (1) per le partite di Girone, confronto diretto punteggio/esito (stesse squadre); (2) per il knockout, confronto degli _insiemi_ di squadre previste vs reali a ogni turno (chi raggiunge ottavi, quarti, ...), non degli accoppiamenti.
_Avoid_: Diff, scarto, errore

**Terza qualificata**:
Una squadra arrivata terza nel proprio Girone che accede al Tabellone. Solo le 8 migliori terze passano. Ranking semplificato (non la combinatoria FIFA completa).
_Avoid_: Best third, ripescata

**Fase 1**:
La prima finestra di pronostici, compilata all'inizio: tutti i Gironi più l'intero Tabellone previsto (R32→Finale) in un colpo solo, partendo dalle proprie Classifiche. Si congela al primo calcio d'inizio del torneo. È la fase che genera il Bonus.
_Avoid_: Fase iniziale, fase a gironi (ambiguo: la Fase 1 include anche il bracket previsto)

**Fase 2**:
La seconda serie di pronostici, sul Tabellone reale. Si apre a turni (rolling): a Gironi finiti si pronosticano gli accoppiamenti reali dei sedicesimi; a sedicesimi finiti quelli reali degli ottavi; e così via fino alla Finale. Ogni finestra si pronostica sempre sulle squadre vere di quel turno.
_Avoid_: Ripescaggio, seconda chance

**Bonus**:
Punti extra premiati alla Fase 1 per preveggenza: per ogni squadra che il Tabellone previsto in Fase 1 dava a un certo turno (sedicesimi/ottavi/...) e che lo raggiunge davvero nel Tabellone reale. Conteggio per squadra×turno (set-based, non accoppiamenti), cumulativo lungo i turni e con peso crescente verso la Finale.
_Avoid_: Jolly, premio, malus

**Classifica Gironi / Classifica Tabellone / Classifica Bonus / Classifica Totale**:
Le quattro viste di graduatoria. Gironi: punti dai Pronostici dei Gironi. Tabellone: punti dai Pronostici di Fase 2. Bonus: punti di preveggenza della Fase 1. Totale: la somma delle tre. Le tre componenti sono sempre visibili separatamente.
_Avoid_: Leaderboard, ranking, punteggio generale
