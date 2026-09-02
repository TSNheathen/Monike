# Phase 1 — schéma, migrace a seed data

Schéma vzniká pouze dopřednými migracemi v `pb_migrations/`. Migrace zachovají
prototypové články i galerii. Pozdější dopředná migrace zavádí editovatelné
`blog_labels`, převádí existující hodnoty `posts.categories` na relace
`posts.labels` a původní fixed multi-select odstraňuje. Prototypovým článkům bez
kategorie se label neodhaduje a veřejná pravidla je nezpřístupní.

Pevně seedované identity jsou:

- `site_content.key = main`;
- `about_page.key = main`;
- právě pět `landing_cards.slot` hodnot `gallery`, `cesty`, `vzpominky`,
  `kocicky-andy`, `proces-tvorby`;
- výchozí čtyři záznamy `blog_labels`; jejich názvy, slugs, barvy i pořadí pak
  owner spravuje v CMS.

Ověření prázdné databáze, prototypového upgradu i převodu původních kategorií:

```bash
npm run test:migrations
```

Test používá izolované databáze v `app/.tmp/` a nemění běžná ani produkční
data.
