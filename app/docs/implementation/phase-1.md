# Phase 1 — schéma, migrace a pevná data

Schéma vzniká pouze dopřednými migracemi v `pb_migrations/`. Migrace zachovají
prototypové články i galerii; starým článkům kategorie neodhadují a bez kategorie
je veřejná pravidla nezpřístupní.

Pevně seedované identity jsou:

- `site_content.key = main`;
- `about_page.key = main`;
- právě pět `landing_cards.slot` hodnot `gallery`, `cesty`, `vzpominky`,
  `kocicky-andy`, `proces-tvorby`.

Ověření prázdné databáze i dopředné migrace prototypové databáze:

```bash
npm run test:migrations
```

Test používá izolované databáze v `app/.tmp/` a nemění běžná ani produkční
data.
