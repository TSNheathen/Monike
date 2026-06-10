# Moniké

Vite + React veřejný web a administrační rozhraní pro Moniké.

## Lokální spuštění

```bash
npm install
npm run dev
```

Web běží na:

```txt
http://127.0.0.1:5173/
```

## PocketBase

Chyba `Článek se nepodařilo uložit. Je PocketBase spuštěný?` znamená, že frontend běží, ale backend ještě neběží na `http://127.0.0.1:8090`.

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

Při prvním spuštění se automaticky aplikují migrace z `pb_migrations`.

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

## Konfigurace URL backendu

Výchozí hodnota:

```txt
VITE_POCKETBASE_URL=http://127.0.0.1:8090
```

Pro jiné prostředí vytvoř `.env` podle `.env.example`.
