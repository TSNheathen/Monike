# Moniké

Vite + React veřejný web a administrační rozhraní pro Moniké.

Aplikace je v adresáři:

```txt
app/
```

Projektová dokumentace a podklady jsou v:

```txt
app/docs/
```

## Lokální spuštění

```bash
cd app
npm install
npm run dev
```

Web běží na:

```txt
http://127.0.0.1:5173/
```

## PocketBase

Chyba `Článek se nepodařilo uložit. Je PocketBase spuštěný?` znamená, že frontend běží, ale backend ještě neběží na `http://127.0.0.1:8090`.

Příkazy níže spouštěj z adresáře `app/`.

Stáhni PocketBase:

```bash
npm run pb:download
```

Spusť PocketBase:

```bash
npm run pb:serve
```

PocketBase poběží na:

```txt
http://127.0.0.1:8090
```

Admin dashboard PocketBase:

```txt
http://127.0.0.1:8090/_/
```

Při prvním spuštění se automaticky aplikují migrace z `app/pb_migrations`.
Běžný development má `VITE_USE_DEV_FIXTURES=false`, takže veřejný web i admin
čtou a zapisují stejný lokální PocketBase. Fixtures jsou pouze explicitní
vývojový opt-in a galerie je nepoužívá nikdy.

## První administrátor webu

V PocketBase dashboardu vytvoř záznam v auth kolekci `admins`:

```txt
email
password
```

Potom se v aplikaci přihlas přes:

```txt
http://127.0.0.1:5173/admin/login
```

Bez přihlášení tě administrační stránky přesměrují na login. To je správné chování, protože pravidla PocketBase dovolují ukládání článků a galerie jen přihlášeným záznamům z kolekce `admins`.

## Konfigurace URL backendu

Výchozí hodnota:

```txt
VITE_POCKETBASE_URL=http://127.0.0.1:8090
```

Pro jiné prostředí vytvoř `app/.env` podle `app/.env.example`.
## Produkční release na Roští.cz

Používáme Roští **Stack**: Node HTTP server + PocketBase, společná veřejná
doména a persistentní data mimo kontejnery. Podporované nasazení už nepoužívá
Vercel ani Fly. Konfigurace: `app/docker-compose.rosti.yml`,
`app/rosti.env.example`. Kompletní kroky včetně migrace dat, účtů, záloh a
proxy bezpečnosti jsou v [deployment runbooku](app/docs/implementation/operations/deployment-runbook.md).

Pro lokální ověření buildu nastav v PowerShellu:

```powershell
$env:VITE_APP_ENV='test'
$env:VITE_SITE_URL='http://127.0.0.1:3000'
$env:VITE_POCKETBASE_URL='http://127.0.0.1:8090'
$env:VITE_USE_DEV_FIXTURES='false'
npm run build
npm start
```

`npm start` čte serverové hodnoty z `app/.env` podle `.env.example`.
PocketBase musí běžet v druhém terminálu. Lokální build je na
http://127.0.0.1:3000; pro release použij produkční HTTPS hodnoty, ne režim test.

## Kontroly

```sh
npm test
npm run build
npm run test:migrations
npm run test:e2e:install
npm run test:e2e
npm run test:image
```

Build potřebuje environment hodnoty uvedené výše nebo produkční hodnoty
z runbooku. Testy používají oddělená data v `app/.tmp` a porty 4173/8095.
`npm test` hlídá i limit 700 řádků vlastních JS/JSX souborů.

V CMS lze měnit pozadí úvodní stránky. Blog v menu rozbaluje aktuální štítky; odkaz
„Všechny články“ uvnitř skupiny vede na celý blog. Na blogu včetně filtru a detailu
článku zůstává skupina rozbalená na desktopu i v mobilním menu. Jména, barvy a URL štítků pocházejí
z PocketBase; otevřené veřejné stránky reagují na jejich změny přes realtime.
