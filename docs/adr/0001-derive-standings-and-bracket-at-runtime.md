# Persistiamo solo i pronostici grezzi, classifiche e tabellone sono derivati a runtime

Il database memorizza esclusivamente gli input grezzi dell'utente (punteggi pronosticati per ogni Partita + flag rigori sui pareggi knockout). Classifiche dei Gironi, qualificate, riempimento degli slot del Tabellone e propagazione dei vincenti **non vengono persistiti**: sono ricalcolati in memoria a ogni render, lato client.

## Perché

Con 48 squadre il calcolo è banale e istantaneo, e un singolo source-of-truth elimina ogni rischio di stato derivato incoerente (classifiche o bracket disallineati rispetto ai pronostici). L'alternativa — materializzare classifiche/bracket in tabelle — comprerebbe query più veloci che non ci servono, al prezzo di logica di invalidazione.

## Conseguenza

Un futuro lettore non troverà tabelle `standings` o `bracket` nello schema: è deliberato, non un'omissione. La logica di derivazione (tie-break, qualificazione terze, propagazione) vive nel codice, non nei dati.
