# Release Roští, 2026-09-20

## Změny

- Roští Stack se dvěma kontejnery, Node HTTP server a PocketBase; odstraněny
  Vercel rewrites/functions dependency a oba Fly TOML soubory.
- Zachovány veřejné SEO statusy/metadata, server-owned rich text, chráněná média,
  session auth, rate limits a superuser IP allowlist. Proxy přepíše interní IP header.
- Zálohy lokálně na persistentním disku nebo volitelně na S3, bez povinného R2.
- Dopředná migrace `20260920120000_landing_background.js`: volitelný soubor
  `site_content.landing_background`, server-owned `background_width/height`.
  Upload používá stejnou normalizaci, signature/decode kontroly a limit 4096 px
  jako ostatní obrázky. Bez souboru či při chybě zůstane původní dekorativní grafika.
- Sdílená `PublicNavigation` pro desktop/mobile: klik na Blog rozbalí skupinu,
  na blogu včetně filtrů a detailu zůstává skupina vždy otevřená.
  Odkaz Všechny články vede na /blog. Bez chevronu a barevných pruhů štítků;
  zachované aria-controls/expanded, Enter/Space, Escape a návrat focusu.
- Labels se načítají z PocketBase; realtime aktualizuje menu, landing karty,
  seznam, filtr, detail a admin výběr, aniž zahodí rozepsaný článek.
- Cleanup assetů extrahován z `operations.js` do `asset-cleanup.js`.
  Nové concerns jsou `LandingBackground` a malé server moduly. Test hlídá limit
  700 řádků všech vlastních JS/JSX souborů mimo generované závislosti/artifacts.

## Ověření

- `npm test`: 87 testů, včetně skutečného Node HTTP serveru, proxy a limitu řádků.
- `npm run test:migrations`: fresh, prototypový upgrade, převod kategorií,
  upgrade poslední verze se zachováním vlastního obsahu.
- Playwright: 48 testů nad Vite; jeden HTTP-only test záměrně běží samostatně
  nad buildem. Tam všech pět release testů prošlo, včetně stejnooriginového API,
  realtime, CMS uploadu, screenshotů a axe A/AA na obou menu.
- Produkční Vite build a oba Docker image buildy; PocketBase image smoke
  včetně fresh migrací, readiness a UID 10001. Smoke obou propojených kontejnerů
  ověřil produkční HTML, proxy, lokální backups policy, sitemap a 404.
- `docker compose ... config --quiet` a `git diff --check` prošly.

## Známé Omezení

`npm audit --omit=dev` vrací nenulový exit: 27 moderate položek, 0 high/critical.
Jde o Tiptap core a navázané balíčky (GHSA-cp6q-959q-f8rh) a dva již evidované
React Router nálezy. Audit nabízí major upgrady na Tiptap 3 / Router 7;
tento release je neprovádí. To není čistý bezpečnostní audit ani tvrzení,
že knihovní nálezy byly opraveny. Před publikací posoudit zbytkové riziko;
stávající strict rich-text validace a serverové HTML zůstaly zachovány.

Skutečný Stack nebyl nasazen bez účtu/credentials. DNS/TLS, secrets, původní data,
autoritativní X-Real-IP na vstupní proxy a restore drill je potřeba ověřit podle
[aktuálního runbooku](operations/deployment-runbook.md). Lokální testy nenahrazují
ověření těchto hostingových hranic.
