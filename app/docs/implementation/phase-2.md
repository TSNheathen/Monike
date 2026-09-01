# Phase 2 — důvěryhodné operace PocketBase

Vícezáznamové změny používají tyto úzké aplikační routy:

```text
POST /api/monike/content-assets/stage
POST /api/monike/posts/save
POST /api/monike/posts/{id}/delete
POST /api/monike/about/save
POST /api/monike/gallery/reorder
GET  /api/monike/articles/{slug}
```

Zápisové routy přijímají pouze Bearer token kolekce `admins`; token
`_superusers` jako aplikační identitu odmítnou. Alias historie a
`content_assets` nemají běžné klientské create/update/delete oprávnění.
Článek se vytváří, ukládá, publikuje a maže pouze přes transakční routy;
samostatný update zůstává jen pro cover.

Kanonickým zdrojem článku a příběhu O mně je `content_json`. Server jej
validuje podle přesného v1 schématu a vždy znovu vytvoří `content_html`.
Klientem poslané HTML ani `published_at`, vlastnictví assetu či stav `active`
nejsou autoritativní.

Inline upload je nejdřív neaktivní. Server kontroluje příponu, MIME, binární
signaturu, byte limit, rozměry do 8192 px / 32 Mpx a provede skutečný decode
PocketBase thumbnail pipeline. Rozměry zapisuje server. JPEG, PNG a WebP jsou
jediné povolené formáty. Cron `monikeInactiveAssetsCleanup` denně odstraňuje
jen stále neaktivní, nereferencované assety starší sedmi dnů.

## Runtime policy

Nasazené prostředí aplikuje PocketBase nastavení příkazem:

```bash
npm run pb:reconcile
```

Příkaz vyžaduje serverové proměnné (nikdy `VITE_*`):

```text
APP_ENV=demo|production
MONIKE_PUBLIC_POCKETBASE_URL=https://...
MONIKE_ALLOWED_ORIGINS=https://...
MONIKE_SUPERUSER_IPS=konkrétní IP/CIDR
POCKETBASE_SUPERUSER_EMAIL=...
POCKETBASE_SUPERUSER_PASSWORD=...
```

Volitelný `POCKETBASE_ADMIN_URL` slouží pouze pro operátorské spojení, pokud se
liší od veřejné API adresy (například při lokálním ověření). Policy zapne
rate limiting, důvěru pouze v `Fly-Client-IP`, osmihodinový token z migrace,
superuser IP allowlist a skryje schema ovládání Dashboardu. Proces PocketBase
musí současně dostat stejné přesné originy přes `--origins`; lokální runner má
vlastní pevný localhost allowlist.

## Ověření

```bash
npm test
npm run test:migrations
npm run test:e2e
npm run build
```

Testovací server jediný nastavuje `MONIKE_TEST_MODE=true`. Tím zpřístupní jen
hlavičkou řízené vnitřní body selhání pro důkaz rollbacku; bez této explicitní
testovací proměnné nemají hlavičky žádný účinek.
