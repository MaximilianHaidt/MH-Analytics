# MH Analytics Roadmap

Diese Datei dokumentiert geplante Ausbaustufen. Sie aktiviert keine neuen Funktionen.

## Login / Cloud-Sync Architekturplan

Status: geplant, nicht implementiert.

Ziel spaeter: Nutzer koennen Watchlists, Favoriten, Portfolios, Alerts, Journal, Preferences, Learning/XP und Report-Metadaten optional zwischen Geraeten synchronisieren. Die bestehende lokale Nutzung, Demo-Daten und Setup Export/Import bleiben erhalten.

## Grundprinzipien

- Kein Login-Zwang fuer die aktuelle App.
- Lokale Nutzung bleibt der Default.
- Cloud-Sync ist spaeter Opt-in: Der Nutzer entscheidet aktiv, ob lokale Daten in ein Konto uebernommen werden.
- API-Keys, Betreiber-Secrets und Provider-Konfiguration werden nie synchronisiert.
- Frontend ruft externe Datenprovider weiterhin nur ueber eigene `/api/...` Routen auf.
- Finanzdaten und Journal-Eintraege gelten als sensibel und muessen datensparsam behandelt werden.

## Auth-Optionen

### Supabase Auth

Vorteile:

- Auth, Postgres und Row Level Security passen gut zu nutzereigenen Finanzdaten.
- Relationale Tabellen plus `jsonb` sind geeignet fuer Portfolios, Alerts und Journal.
- RLS kann erzwingen, dass Nutzer nur eigene Zeilen sehen.
- Gute spaetere Basis fuer serverseitige Alert-Jobs.

Risiken / Aufwand:

- Datenmodell, RLS-Policies, Backups und Loeschkonzept muessen sauber entworfen werden.
- Supabase-Projekt, Umgebungsvariablen und Deployment-Prozess kommen hinzu.
- Fehlerhafte RLS waere ein kritisches Sicherheitsrisiko.

Einschaetzung:

- Starker Kandidat fuer MH Analytics, wenn Cloud-Sync mittelfristig ernsthaft gebaut wird.

### Firebase Auth

Vorteile:

- Bewaehrte Auth, gute Client-SDKs und Firestore-Sync.
- Geeignet fuer dokumentenbasierte User-Daten.
- Offline-/Realtime-nahe Sync-Muster sind spaeter gut abbildbar.

Risiken / Aufwand:

- Security Rules muessen sehr sorgfaeltig gepflegt werden.
- Komplexe Portfolio-/Report-Abfragen sind in Firestore weniger natuerlich als in SQL.
- Vendor-spezifische Datenmodellierung.

Einschaetzung:

- Gut fuer schnelle nutzerbezogene Sync-Dokumente, weniger ideal fuer spaetere analytische Abfragen.

### Auth.js

Vorteile:

- Flexibler Auth-Layer mit vielen Providern.
- Gut, wenn spaeter ein Next.js-/Server-App-Teil entsteht.
- Unabhaengiger von einem einzelnen BaaS-Anbieter.

Risiken / Aufwand:

- Braucht trotzdem eine Datenbank bzw. Adapter fuer Sessions/User.
- Passt weniger direkt zu einer statischen App ohne Rebuild.
- Wuerde wahrscheinlich eine groessere Architekturentscheidung erfordern.

Einschaetzung:

- Sinnvoll, wenn MH Analytics spaeter ohnehin in Richtung Next.js/App-Router oder eigenes Backend geht.

### Eigener Backend-Ansatz

Vorteile:

- Maximale Kontrolle ueber Auth, Daten, Audit, Loeschung, Export und Alert-Jobs.
- Kann exakt auf MH Analytics zugeschnitten werden.

Risiken / Aufwand:

- Hoechster Sicherheits- und Wartungsaufwand.
- Passwort-/Session-Sicherheit, Rate-Limits, Abuse-Schutz und Datenschutz muessen selbst getragen werden.
- Fuer die naechste Phase zu schwer.

Einschaetzung:

- Spaeter moeglich, aber nicht als erster Cloud-Sync-Schritt.

## Geplantes Datenmodell

Empfehlung fuer V1: nutzerbezogene Tabellen mit stabiler `user_id`, `schema_version`, `updated_at`, `deleted_at` und optionalem `payload` fuer modulnahe JSON-Strukturen. So bleibt die Migration aus lokalen Browserdaten kontrollierbar.

### Kernobjekte

`users`

- `id`
- `auth_provider`
- `auth_subject`
- `email_hash` optional
- `created_at`
- `last_login_at`
- `delete_requested_at`

`user_preferences`

- `user_id`
- `dashboard_mode`
- `display_settings`
- `module_preferences`
- `shortcuts`
- `schema_version`
- `updated_at`

`favorites`

- `id`
- `user_id`
- `symbol`
- `asset_type`
- `created_at`
- `updated_at`
- `deleted_at`

`watchlist_items`

- `id`
- `user_id`
- `symbol`
- `name_snapshot`
- `asset_type`
- `notes`
- `tags`
- `created_at`
- `updated_at`
- `deleted_at`

`portfolios`

- `id`
- `user_id`
- `name`
- `type`
- `base_currency`
- `cash`
- `payload`
- `created_at`
- `updated_at`
- `deleted_at`

`portfolio_positions`

- `id`
- `portfolio_id`
- `user_id`
- `symbol`
- `quantity`
- `avg_price`
- `currency`
- `notes`
- `created_at`
- `updated_at`
- `deleted_at`

`alerts`

- `id`
- `user_id`
- `symbol`
- `alert_type`
- `condition`
- `target`
- `priority`
- `snoozed_until`
- `status`
- `created_at`
- `updated_at`
- `deleted_at`

`journal_entries`

- `id`
- `user_id`
- `symbol`
- `decision_type`
- `emotion`
- `mistakes`
- `thesis`
- `review_state`
- `payload`
- `created_at`
- `updated_at`
- `deleted_at`

`learning_state`

- `user_id`
- `xp`
- `level`
- `completed_actions`
- `quiz_answers`
- `updated_at`

`report_metadata`

- `id`
- `user_id`
- `report_type`
- `title`
- `symbols`
- `created_at`
- `data_status_snapshot`
- `payload_summary`

`sync_metadata`

- `user_id`
- `device_id`
- `last_sync_at`
- `schema_version`
- `last_migration_at`

## Nicht synchronisieren

Diese Daten duerfen weder in Cloud-Sync noch in Setup Export/Import aufgenommen werden:

- API-Keys
- Provider-Secrets
- Betreiber-Konfiguration
- Vercel Environment Variables
- Provider-Testdaten
- interne Debug- oder Diagnoseausgaben
- direkte Provider-Tokens oder Provider-URLs mit Secrets

## Sicherheitsregeln

- Nutzer duerfen ausschliesslich eigene Daten lesen, schreiben und loeschen.
- Serverseitig muss die `user_id` aus der verifizierten Auth-Session kommen, nicht aus frei gesetzten Client-Feldern.
- Row Level Security oder Security Rules muessen fuer alle nutzerbezogenen Tabellen aktiv sein.
- API-Keys bleiben ausschliesslich serverseitig in Vercel Environment Variables.
- Cloud-Sync-Endpunkte duerfen keine Provider-Keys annehmen, speichern oder zurueckgeben.
- Setup Export/Import bleibt lokal moeglich und muss weiterhin Secrets ausschliessen.
- Soft Delete mit `deleted_at` kann Sync-Konflikte vermeiden; echte Account-Loeschung muss spaeter alle Nutzerdaten entfernen.
- Rate-Limits fuer Login, Sync und Alert-Aktionen sind Pflicht.
- Audit-Logs duerfen keine sensiblen Journal- oder Portfolioinhalte im Klartext protokollieren.

## Datenschutzpunkte

- Transparenter Hinweis: lokale Nutzung ohne Konto bleibt moeglich.
- Cloud-Sync nur nach aktiver Zustimmung.
- Datenarten klar nennen: Watchlist, Portfolios, Alerts, Journal, Preferences, Learning/XP, Report-Metadaten.
- Journal und Portfolio als besonders sensible Inhalte behandeln.
- Export, Import und spaetere Konto-Loeschung dokumentieren.
- Datenschutzerklaerung vor Aktivierung von Login/Cloud-Sync final juristisch pruefen.
- Hosting-/Auth-/Datenbankanbieter muessen in Datenschutz und ggf. Auftragsverarbeitung beruecksichtigt werden.

## Migrationsplan

Phase 0: Jetzt

- Nur Planung und Dokumentation.
- Lokale Speicherung bleibt unveraendert.
- Keine Login-UI aktivieren.

Phase 1: Schema vorbereiten

- Cloud-Datenmodell finalisieren.
- Storage-Key-Schema und lokale Exportstruktur versionieren.
- Secret-Blacklist fuer Sync/Export validieren.

Phase 2: Opt-in Import

- Nutzer meldet sich spaeter an.
- App zeigt Vorschau: welche lokalen Daten koennen in die Cloud uebernommen werden.
- Nutzer entscheidet: hochladen, lokal behalten oder spaeter entscheiden.

Phase 3: Bidirektionaler Sync

- Last-write-wins fuer einfache Preferences/Favoriten.
- Objektbasierte Konfliktloesung fuer Portfolios, Alerts und Journal.
- `deleted_at` fuer Loeschungen ueber Geraete hinweg.

Phase 4: Export/Import bleibt Fallback

- JSON Export/Import bleibt weiterhin nutzbar.
- Export enthaelt keine API-Keys und keine Betreiber-Secrets.

## Spaeterer Alert-Server

Ein spaeterer Alert-Server ist getrennt vom ersten Login-Schritt zu planen.

Moegliche Architektur:

- serverseitiger geplanter Job oder Cron
- liest nur aktive Alerts des Nutzers
- ruft Marktdaten ueber bestehende serverseitige `/api/...` Providerpfade ab
- prueft Bedingungen
- schreibt Alert-Events in eine nutzerbezogene Tabelle
- optional spaeter E-Mail oder Push nach separater Zustimmung

Pflichten:

- Rate-Limits pro Nutzer und Provider
- keine Provider-Keys im Client
- keine Push-/E-Mail-Zustellung ohne Opt-in
- klare Snooze- und Loeschlogik
- Datenschutz und Benachrichtigungsrecht beachten

## Community-Konzept V1

Status: geplant, nicht implementiert.

Ziel spaeter: MH Analytics kann eine vorsichtig moderierte Community bekommen, in der Nutzer Ideen, oeffentliche Watchlists und Research-Gedanken lesen oder spaeter teilen koennen. Diese Runde oeffnet keine Community-Funktion, keine Posts, keine Kommentare, kein Login und keine Interaktionsdaten.

## Community-Grundprinzipien

- Community darf nicht als Anlageberatung wirken.
- Keine echten Kauf-/Verkaufsempfehlungen als Produktversprechen.
- Keine Pump-and-Dump-Foerderung, keine Kursziel-Schlachten, kein Hype-Design.
- Nutzerbeitraege muessen klar von MH Analytics Daten, Scores und Reports getrennt sein.
- Moderation, Meldesystem, Regeln und Haftung muessen vor Schreibfunktionen fertig sein.
- Minderjaehrige Nutzer, Datenschutz und rechtliche Anforderungen muessen vor oeffentlicher Aktivierung geprueft werden.

## Geplante Community-Bereiche

`user_profiles`

- oeffentlicher Anzeigename
- optionaler Avatar oder Initialen
- Erfahrungs-/Interessen-Tags
- keine Pflicht zur echten Identitaet im oeffentlichen Feed
- spaeter private Konto- und Loeschfunktionen

`public_watchlists`

- oeffentlich geteilte Muster-Watchlists
- Titel, Kurzbeschreibung, Symbole, Datenstatus
- keine echten Depots und keine Positionsgroessen als Empfehlung
- deutlicher Hinweis: Beobachtungsliste, keine Empfehlung

`investment_ideas`

- strukturierte Ideen mit These, Risiko, Trigger, Datenstatus und Zeithorizont
- Pflicht-Disclaimer bei jeder Idee
- keine garantierten Renditen, keine sicheren Prognosen
- klare Trennung zwischen Meinung, Datenstatus und Modelllogik

`comments`

- spaeter nur mit Login und Moderation
- sachliche Rueckfragen und Gegenargumente statt Hype
- Melden-Button und Sperrlogik vor Aktivierung Pflicht

`likes_upvotes`

- spaeter als Qualitaets-/Hilfreichkeits-Signal, nicht als Kauf-Signal
- keine Ranglisten, die Pumping beguenstigen
- Missbrauchsschutz und Rate-Limits Pflicht

`moderation`

- Regeln, Meldungen, Review-Queue, Sperren und Loeschung
- Moderationsstatus pro Beitrag
- Audit nur mit minimal noetigen Daten
- keine sensiblen Portfolio-/Journal-Inhalte in Moderationslogs

`reports`

- Melden von Beitraegen, Kommentaren und Profilen
- Kategorien: Spam, Pumping, Beleidigung, Finanzberatung, Falschinformation, Datenschutz, sonstiges
- Review-Fristen und Eskalation spaeter definieren

## Community-Regeln

- Keine Anlageberatung.
- Keine Aufforderung zum Kauf, Verkauf oder Halten.
- Keine garantierten Renditen oder sicheren Prognosen.
- Keine koordinierten Pump-and-Dump-Aktionen.
- Keine irrefuehrenden Screenshots oder erfundenen Daten.
- Quellen und Datenstatus muessen genannt werden, wenn konkrete Daten behauptet werden.
- Interessenkonflikte muessen spaeter kenntlich gemacht werden.
- Respektvoller Umgang, keine persoenlichen Angriffe.
- Datenschutz beachten: keine fremden personenbezogenen Daten posten.

## Community-Roadmap

Phase 1: Lesender Ideenfeed

- kuratierte oder redaktionell vorbereitete Ideen lesen
- keine Nutzerbeitraege
- keine Kommentare
- keine Likes
- jeder Eintrag mit Datenstatus, Quellenhinweis und Disclaimer

Phase 2: Login

- erst nach finaler Auth-/Cloud-Sync-Entscheidung
- Nutzerprofile minimal und datensparsam
- Account-Loeschung und Datenschutztexte vorher klaeren

Phase 3: Eigene Beitraege

- strukturierte Ideen-Templates
- Pflichtfelder: These, Risiko, Datenstatus, Zeithorizont, Disclaimer
- keine freien Pumping-Posts als erstes Schreibformat

Phase 4: Moderation

- Melden-System
- Review-Queue
- Sperren/Loeschen
- Rate-Limits
- Missbrauchs- und Spam-Schutz

Phase 5: Reputation / Level

- Reputation nur fuer hilfreiche, sachliche Beitraege
- keine Leaderboards fuer Performance oder Renditeversprechen
- keine Gamification, die riskantes Verhalten belohnt

Phase 6: Oeffentliche Muster-Watchlists

- Watchlists als Ideen-/Beobachtungslisten
- keine Depotnachbildung als Empfehlung
- klare Datenstatus- und Haftungshinweise

## Community-Risiken

Moderation:

- Schreibfunktionen erfordern klare Regeln, Review-Prozesse und personelle Verantwortung.

Rechtslage:

- Anlageberatung, Haftung, Impressum/Datenschutz und Plattformverantwortung muessen vor Aktivierung juristisch geprueft werden.

Falschinformationen:

- Nutzer koennen falsche Daten, manipulierte Screenshots oder irrefuehrende Schlussfolgerungen posten.

Pumping:

- Upvotes, Hype, Ranglisten und Watchlists koennen Pump-and-Dump-Verhalten beguenstigen.

Datenschutz:

- Profile, Kommentare, Meldungen und Watchlists koennen personenbezogene oder sensible Finanzdaten enthalten.

Minderjaehrige Nutzer:

- Zugang, Inhalte und Datenschutz muessen gesondert bewertet werden.

Finanzberatung:

- Die Plattform muss verhindern, dass Community-Inhalte als individuelle Beratung oder Empfehlung dargestellt werden.

## Community bewusst nicht gebaut

- keine Community-Seite
- kein Feed
- keine Profile
- keine Posts
- keine Kommentare
- keine Likes oder Upvotes
- kein Melden-System
- keine Moderationsoberflaeche
- kein Login
- keine Datenbank
- keine neue API

## Offene Entscheidungen

- Auth-Provider final auswaehlen.
- Datenbanktyp final auswaehlen.
- Cloud-Sync-Konfliktstrategie finalisieren.
- Account-Loeschprozess spezifizieren.
- Datenschutztexte juristisch pruefen.
- Alert-Server getrennt priorisieren.
- Community-Rechtsrahmen und Moderationsverantwortung klaeren.
- Community erst nach Auth-/Datenschutz-/Moderationskonzept aktivieren.
