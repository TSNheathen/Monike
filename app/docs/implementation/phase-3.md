# Phase 3 — sdílený frontendový základ

Stav: **PASS** (2026-09-01)

## Implementováno

- monolitický stylesheet je nahrazen agregátorem a smluvenými vrstvami `tokens`, `base`, `primitives`, `rich-text`, `public` a `admin`;
- veřejná a administrační část používají jednu černo-zlatou Moniké tokenovou soustavu, společný focus a společné button/form/panel/state/dialog/status prvky;
- landing page zachovává původní vrstvenou kompozici a byla vizuálně ověřena při 1440×900 a 390×844;
- `PublicFrame` obsahuje sdílenou navigaci, skip link, jediný `main` landmark a základ route-focus chování;
- `AdminFrame` obsahuje značkový desktop sidebar, mobilní top bar/drawer a navigaci Blog / Labels / Galerie / Web;
- PocketBase klient používá vlastní `SessionAuthStore`, nikdy SDK `LocalAuthStore`; session je nejvýše osm hodin a logout ji odstraňuje;
- reautentizační boundary zachová lokální data a po úspěchu automaticky neopakuje původní operaci;
- API chyby se normalizují na `auth-expired`, `forbidden`, `not-found`, `unavailable`, `validation`, `conflict`, `configuration` a `error`;
- úspěšný prázdný seznam zůstává stav `empty`, technická chyba se na něj nikdy nepřekládá;
- label query helper přijímá právě jeden bezpečný slug; existenci ověří proti `blog_labels` a relation filtr používá parametr binding;
- metadata helper skládá absolutní canonical/OG/Twitter URL pouze z `VITE_SITE_URL`;
- responsive-media helper implementuje role a width ladder z #14, nevytváří zbytečný upscale a podporuje chráněné file tokeny;
- DEV fixtures zůstávají oddělené a stávající build guard je nadále znemožňuje v demo/production.

## Ověření exit condition

- `npm test`: PASS — 13 souborů / 35 testů;
- `npm run build`: PASS;
- `npm run test:e2e`: PASS — 12 testů;
- `npm run test:migrations`: PASS — fresh i upgrade;
- `git diff --check`: PASS;
- 360×800: jeden `main`, funkční skip link a žádný page-level horizontal scroll;
- browser test dokládá owner token v `sessionStorage`, žádný auth token v `localStorage` ani cookie;
- cílené testy dokládají bezpečný filter binding, odmítnutí neplatného nebo neznámého labelu před dotazem na články, oddělení empty/error/not-found, osmihodinový session limit a media candidate policy.

React Router pouze vypisuje známá upozornění na volitelné v7 future flags; nejde o selhání brány.

## Záměrně navazuje v dalších fázích

- finální CMS-backed stavové obrazovky a odstranění runtime sample fallback ze stránek jsou Phase 4A;
- úplná admin CRUD obrazovka, dirty-state wiring a použití reauth dialogu jsou Phase 4B;
- úplné focus trapping/inert chování drawerů, GLightbox gate a manuální screen-reader matice jsou Phase 6.
