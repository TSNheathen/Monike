# Nasazení Moniké na Roští.cz

Podporovaný cíl tohoto releasu je **Roští Stack**, ne staré Roští Aplikace.
React + Vite + PocketBase zůstávají. Vercel/Fly konfigurace a závislost
`@vercel/functions` byly odstraněny. Staré phase dokumenty jsou historický záznam.

## Runtime

`docker-compose.rosti.yml` má dva kontejnery: Node 22 obsluhuje Vite build,
SEO HTML a streamovanou proxy; PocketBase 0.40.1 obsluhuje CMS, auth, SQLite
a soubory. Jen web publikuje `80:3000`; PocketBase je interní `pocketbase:8080`.
Oba veřejné origins standardně ukazují na jednu doménu. API a soubory používají
`/api/*`, technický dashboard `/_/`, vlastník webu `/admin`.
Žádná další databázová služba ani orchestrátor není potřeba.

Port 80, TLS na vstupní proxy, Compose spravovaný administrací a bind mounty
pod `/srv/stack` odpovídají [dokumentaci Roští Stacků](https://docs.rosti.cz/cs/stacks/quickstart/).
Data jsou v `/srv/stack/data/pocketbase`, nikoli v image.
Kontejnery nemají automatický scale-to-zero.

Node zachovává článek 200, alias 308, skutečné 404 a při nejistém backendu 503,
počáteční SEO metadata, robots/sitemap, CSP, HSTS a demo noindex.
Proxy nepřepisuje pravidla ani cache hlavičky chráněných souborů; streamuje i SSE
a multipart uploady. Frontend nepotřebuje runtime npm dependencies.

## Příprava a první start

1. V Roští administraci vytvoř Stack, zapni SSH/SFTP přístup, nastav doménu v Proxy
   a DNS podle aktuálních údajů hostingu. Vyčkej na platné HTTPS.
2. Obsah `app/` nahraj do `/srv/stack`: Dockerfiles, `.dockerignore`,
   `package.json`, lockfile, `vite.config.js`, `index.html`, `src/`,
   `public/`, `server/`, `api/`, `pb_hooks/`, `pb_migrations/`, `docker/`.
   Nekopíruj lokální `.env`, `node_modules`, `pb_data`, `.tmp` ani testovací účty.
   Nezaměň soubor `docker-compose.rosti.yml` za hostingem spravovaný soubor.
3. Do Compose editoru vlož `app/docker-compose.rosti.yml`. Do jeho .env editoru
   vlož vyplněné hodnoty z `app/rosti.env.example`. Oba veřejné origins musí být
   přesné HTTPS URL bez koncového lomítka; build a runtime musí souhlasit.
4. `MONIKE_SUPERUSER_IPS` nastav na vlastní veřejnou IP/CIDR, ne na proxy IP
   ani celý internet. `PB_ENCRYPTION_KEY` vygeneruj jako náhodných 32 ASCII znaků
   a ulož mimo server do správce hesel. Při migraci zachovej existující klíč.
5. V SSH shellu Stacku sestav obrazy a spusť je (Compose/.env předtím ulož v UI):

```sh
cd /srv/stack
docker compose build
docker compose up -d
docker compose ps
docker compose logs --tail=100 pocketbase web
```

Compose soubor v `/srv/stack/docker-compose.yml` ručně neupravuj, spravuje ho UI.
Alternativně lze oba obrazy postavit lokálně, přenést pomocí standardního
`docker save/load` nebo vlastní registry a spustit stejné image tagy. Nejde o
implicitní podporu jednoslužbového `rosticli stacks push`; dva obrazy se musí
dostat do Stacku oba. `MONIKE_RELEASE` identifikuje konkrétní release.

PocketBase před serve aplikuje dopředné migrace jako UID 10001. Chyba konfigurace
nebo migrace zastaví start. Web čeká na readiness. Před první migrací existující
databáze vždy vytvoř konzistentní PocketBase backup.

## První vlastník a bezpečnost proxy

První technický účet vytvoř pomocí `pocketbase superuser upsert` přes SSH do
kontejneru (UID 10001), s `--dir=/pb/pb_data` a
`--encryptionEnv=PB_ENCRYPTION_KEY`. Heslo zadávej interaktivně a neukládej do
shell historie. Potom přes `https://domena/_/` z povolené IP vytvoř jeden účet
v `admins`, případně použij zachovaný účet z původní databáze.
Webový login nepoužívá superuser účet.

`MONIKE_TRUST_PROXY=true` smí běžet jen za vstupní proxy hostingu.
Node očekává autoritativní `X-Real-IP` a před PocketBase přepíše hlavičku
`X-Monike-Client-IP`; klientské Forwarded/X-Forwarded/Fly hlavičky zahazuje.
PocketBase důvěřuje jen této interní hlavičce. Chybějící/neplatná vstupní IP
znamená 400, ne tiché oslabení allowlistu.

**Před otevřením CMS ověř u konkrétního Stacku**, že Roští přepisuje X-Real-IP
skutečnou klientskou IP i při podvržené klientské hodnotě. Ověř přihlášení
superusera z povolené i nepovolené sítě a rate limit. Veřejný port PocketBase
nepřidávej. Pokud hosting tento header negarantuje, nasazení nepovažuj za hotové;
uprav hranici důvěry podle potvrzené konfigurace proxy. HSTS začíná 300 sekundami;
roční hodnotu nastav až po ověření všech domén.

## Přesun existujících dat

Zastav zápisy na starém webu, vytvoř a stáhni úplný PocketBase backup včetně
uploadů. Obnov nejprve do izolovaného Stacku se stejným encryption key.
Při ručním přesunu zastaveného `pb_data` zachovej celý adresář, ne pouze SQLite;
obnovené soubory musí být zapisovatelné pro UID/GID 10001. Entrypoint mění
vlastníka kořenového adresáře, nikoli rekurzivně všech importovaných souborů.

Zachovej původní veřejný API hostname jako další doménu Stacku, pokud jsou na něj
navázaná absolutní rich-text media URL. Nastav ho i jako
`MONIKE_PUBLIC_POCKETBASE_URL`, aby CSP a nové media URL odpovídaly starým.
V Proxy potom nevynucuj přesměrování API domény na webovou doménu.
Případná změna media origin vyžaduje ověřenou migraci/re-serializaci obsahu,
nikoli slepé textové nahrazování v databázi.

Migrace `20260920120000_landing_background.js` pouze přidává volitelný chráněný
obrázek a serverem vlastněné rozměry; prázdné pozadí použije původní grafiku.
Nemaže labely, články ani nastavení. Nemá destruktivní down migraci.

## Zálohy a obnova

Default je PocketBase backup každý den 02:15 UTC do `pb_data/backups`,
retence 30 produkce / 14 demo. Sleduj místo: do disku se počítají uploady,
zálohy i Docker obrazy. `MONIKE_BACKUP_STORAGE=s3` a `MONIKE_S3_*` umožní
nezávislé soukromé S3 úložiště; R2 není povinné. Při převodu starých R2 secrets
přejmenuj prefix na S3 a výslovně vyber s3. Zapnutí local přesune budoucí zálohy
na disk, staré vzdálené zálohy nemaže.

Hostingové snapshoty nenahrazují konzistentní aplikační zálohu. Pravidelně
obnov zálohu do izolovaného Stacku a ověř záznamy, veřejné i chráněné soubory,
přihlášení a rich text. Uchovávej encryption key odděleně.
Cleanup neaktivních assetů zůstává v 03:30 UTC s minimálním stářím sedm dní.
Před migrací nebo větší aktualizací vytvoř pojmenovaný backup; při incidentu
preferuj forward fix nebo obnovu do nového adresáře, nepřepisuj jedinou kopii dat.

## Release kontroly

Z `app/`:

```sh
npm ci
npm test
npm run test:migrations
npm run test:e2e:install
npm run test:e2e
npm run test:image
```

Build bez Dockeru potřebuje `VITE_APP_ENV=production`,
`VITE_SITE_URL=https://domena`, `VITE_POCKETBASE_URL=https://domena`,
`VITE_USE_DEV_FIXTURES=false`, potom `npm run build`.
`npm start` spouští Node server; runtime proměnné jsou `MONIKE_ENV`,
`MONIKE_SITE_URL`, `MONIKE_POCKETBASE_URL`, `MONIKE_POCKETBASE_INTERNAL_URL`.
`npm run preview` není produkční server a neposkytuje serverové SEO chování.

Pro lokální test stejného HTTP runtime sestav s `VITE_APP_ENV=test`,
oběma VITE origins `http://127.0.0.1:4173`, fixtures false. Potom spusť
`MONIKE_E2E_PRODUCTION=true npx playwright test release-rosti.spec.js`
(v PowerShellu nastav proměnnou přes `$env:MONIKE_E2E_PRODUCTION='true'`).
Playwright používá izolovaná data a porty 4173/8095, ne běžný lokální CMS.

Po deployi ještě ověř HTTPS, /api/health/ready, články 200/308/404, 503 při
nedostupném backendu, robots/sitemap dle prostředí, mobilní menu, upload pozadí,
protected média a obnovu zálohy. Přístup do Roští, DNS a skutečný restore drill
nelze nahradit lokálním testem.
