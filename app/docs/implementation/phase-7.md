# Phase 7 — reprodukovatelný demo deployment a recovery

> Historický záznam před přechodem na Roští. Aktuální deployment a proxy policy: [runbook](operations/deployment-runbook.md).

Stav: **LOKÁLNÍ ARTEFAKT PASS / EXTERNÍ DEMO GATE ČEKÁ** (2026-09-02)

## Lokálně implementováno a ověřeno

- Project-owned multi-stage `Dockerfile.pocketbase` stahuje PocketBase 0.40.1 amd64 a ověřuje oficiální SHA-256.
- Alpine runtime je připnutý verzí i digestem. Image neobsahuje `node_modules`, `.env`, `pb_data` ani frontendový build; balí pouze hooks, migrace a pět migration seed obrázků.
- Fresh image proběhla přes skutečný Docker build a start. Migrace se aplikovaly na prázdný Volume bez sítě pro seed data.
- PocketBase serve běží jako `10001:10001`; `/pb/pb_data` je `0750`, hooks/migrations/seed jsou read-only `0555`.
- Entrypoint selhává při neznámém/konfliktním prostředí, HTTP/wildcard origins, chybějícím 32znakovém encryption key, R2 konfiguraci a nezapisovatelném Volume. Volitelné heartbeat URL validuje pouze tehdy, jsou-li nastavené.
- Bootstrap automaticky reconciliuje `hideControls`, superuser IP allowlist, Fly real-IP header, rate limits, disabled batch API, denní R2 backup 02:15 UTC, retenci 14/30 a 14denní INFO logy.
- `/api/health/live` a `/api/health/ready` jsou minimální; readiness ověřuje SQLite, existenci i write/delete probe `pb_data`.
- Cleanup běží 03:30 UTC, storage kontrola každou hodinu. Pokud owner nastaví heartbeat URL, backup, cleanup a healthy storage mohou poslat jednoduchý externí signál bez logování URL; monitoring není podmínkou startu.
- API odpovědi mají `nosniff`, frame deny a staged HSTS; frontend HSTS používá stejný 300s → 1 rok postup.
- `fly.demo.toml` a `fly.production.toml` drží `fra`, one Machine, `shared-cpu-1x`/1 GB, 5GB Volume, autostop off, min 1, restart always a readiness check 30s/5s.
- Lokální container smoke potvrdil HTTP 200 readiness, HSTS 300, runtime UID 10001 a skutečně uloženou demo runtime policy v PocketBase 0.40.1.
- `npm run test:image`: PASS — reprodukovatelný checksum build, fresh migrace, readiness, non-root proces a Volume permissions; dočasný kontejner se vždy odstraní.

## Zbývá pro Phase 7 exit condition

- vytvořit izolované Fly, Vercel a R2 demo prostředky a dodat jejich credentials/domény;
- deploynout immutable image a frontend, vytvořit odděleného `_superusers` a normálního `admins` vlastníka;
- naplnit záměrná demo data přes migrace/admin a projít hlavní public/admin smoke scénáře;
- vytvořit skutečnou R2 zálohu a obnovit ji do dočasné izolované Fly App/Volume včetně regenerace thumbu;
- zaznamenat image digest, migration head, backup stav a globální `noindex`.

Bez těchto externích kroků není Phase 7 ani celý release označen jako PASS. Postup je v `operations/deployment-runbook.md`.
