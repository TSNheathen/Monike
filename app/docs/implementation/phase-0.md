# Phase 0 — lokální vývoj a testovací základ

Lokální nástroj stáhne a ověří kontrolní součet přesně připnuté serverové verze
PocketBase `0.40.1` pro aktuální platformu. Verze JavaScript SDK v
`package.json` je na serverové verzi nezávislá.

```bash
npm run pb:download
npm run pb:serve
```

Jednotkové a komponentové testy:

```bash
npm test
```

Prohlížečové testy používají Playwright, axe a samostatnou deterministickou
databázi v `app/.tmp/`. Produkční data ani lokální `pb_data` nemění.

```bash
npm run test:e2e:install
npm run test:e2e
```

Vývojové ukázky jsou povolené jen s `VITE_APP_ENV=development`. Build pro
`test`, `demo` nebo `production` se zapnutým `VITE_USE_DEV_FIXTURES=true`
záměrně skončí chybou.
