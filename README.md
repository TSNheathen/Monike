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
