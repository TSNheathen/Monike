# Phase 4A — veřejná CMS aplikace

Stav: **PASS** (2026-09-01)

## Implementováno

- landing page načítá singleton `site_content` a přesně pět pevných `landing_cards`; artwork a vrstvy zůstávají code-owned, zatímco čtyři blogové karty mohou odkazovat na zvolený existující label;
- `/blog` načítá pouze publikované články s labels, řadí je podle prvního publikování a vykresluje barevné label chips;
- validní `?label=<slug>` je před dotazem na články ověřeno proti aktuálním `blog_labels`; neplatná, neznámá, prázdná nebo opakovaná hodnota posts dotaz vůbec nespustí;
- `/blog/:slug` používá serverový resolver a odlišuje canonical záznam, SPA alias redirect, potvrzenou 404 a unavailable/error;
- `/gallery` používá publikované serverové pořadí, významné alt texty, caption metadata a role-specific grid/lightbox zdroje;
- `/o-mne` vyžaduje kompletní singleton, portrét, alt, ověřené rozměry a serverový rich-text cache;
- `/kontakt` vykresluje pouze intro, e-mail, Instagram a Facebook z `site_content`;
- client-side neznámá trasa používá český noindex not-found stav (skutečný HTTP 404 navazuje v Phase 5);
- každá veřejná trasa nastavuje title, description, canonical, robots, OG a Twitter metadata z nakonfigurovaného `VITE_SITE_URL`; canonical článek doplňuje `article:published_time` a cover OG variantu;
- demo prostředí globálně přepisuje robots na `noindex,nofollow`;
- veřejné produkční/demo cesty nikdy neimportují runtime fallback; explicitní DEV fixture source je zvolen před čtením a nikdy až po selhání PocketBase;
- responsive `<img>` markup používá `srcset`, `sizes`, intrinsic rozměry, lazy/eager a article high-priority smlouvu;
- rich-text obrázky mají kompletní kontrolované width 20–100, align a mobile wrap-collapse CSS.

## Detail relation filtru

PocketBase 0.40.1 používá pro membership přes relation ID ověřený bound filtr
`labels.id ?= {:label}`. Historický problém odstraněného fixed multi-selectu je
ponechán pouze jako auditní záznam v
[category-membership-pocketbase-0.40.1.md](./blockers/category-membership-pocketbase-0.40.1.md).

## Ověření exit condition

- `npm test`: PASS — 16 souborů / 43 testů;
- `npm run build`: PASS;
- `npm run test:e2e`: PASS — ready trasy a deterministické empty/unavailable/invalid/not-found/configuration/landing-failure scénáře;
- `npm run test:migrations`: PASS — fresh i upgrade;
- žádná ready veřejná trasa nemá page-level horizontal scroll při 360×800;
- skutečný prázdný seznam nezobrazí fixtures ani retry;
- technická chyba se nezmění na empty/404;
- missing singleton se klasifikuje jako configuration error;
- neplatný nebo neznámý label zůstává HTTP 200, `noindex,follow`, canonical `/blog` a nespustí posts query;
- canonical článek vykresluje pouze serverem odvozený `content_html`;
- landing error skryje CMS hero/karty a nikdy nevypadá jako úspěšně načtený starý obsah.

## Záměrně navazuje

- initial-response článek 200/308/404/503, crawler metadata a skutečné unknown-path HTTP 404 jsou Phase 5;
- finální GLightbox focus/label gate, mobile drawer trapping, axe na všech trasách a manuální AT matice jsou Phase 6;
- obsah About portrait/story v produkci zůstává release-gate content requirement.
