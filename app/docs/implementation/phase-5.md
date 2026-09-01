# Phase 5 — HTTP routing a SEO

Stav: **PASS** (2026-09-01)

## Implementováno

- Obecný Vercel SPA catch-all byl odstraněn. Na `index.html` se přepisují pouze známé veřejné trasy a rodina `/admin/:path*`.
- `/blog/:slug` vstupuje nejdřív do úzké Vercel funkce ve `fra1`, která volá autoritativní PocketBase resolver s třísekundovým timeoutem.
- Canonical publikovaný článek vrací HTTP 200 a už v prvním HTML obsahuje escapovaný title, description, canonical URL, OG, Twitter a `article:published_time` metadata.
- Historický slug vrací HTTP 308 s absolutním `Location`; potvrzeně chybějící nebo neveřejný článek vrací HTTP 404.
- Síťová chyba, timeout, neplatná nebo nejednoznačná odpověď resolveru vrací HTTP 503, `Cache-Control: no-store` a `Retry-After: 60`; technická chyba se nikdy nevydává za 404.
- Neznámá pathname nemá SPA rewrite a končí skutečným HTTP 404; samostatné české `404.html` a `503.html` respektují vizuál Moniké a obsahují skutečný HTML text.
- Produkční `/sitemap.xml` obsahuje pouze známé veřejné code routes a canonical publikované kategorizované články. Dotaz je stránkovaný, výsledek má hodinovou CDN cache a backend failure vrací 503.
- Produkční `robots.txt` povoluje public a zakazuje `/admin/`. Demo blokuje crawling, nemá veřejnou sitemap a globální Routing Middleware přidává `X-Robots-Tag: noindex,nofollow`.
- Vite zapisuje robots meta už při buildu: production `index,follow`, demo/test `noindex,nofollow`.

## Ověření exit condition

- Black-box Vercel-like HTTP test používá skutečný lokální HTTP server a ověřuje status, `Location`, cache hlavičky, retry, X-Robots a initial-response metadata pro 200/308/404/503.
- Konfigurační test dokládá pořadí article resolveru, přesný seznam SPA rewrites, absenci catch-all a `fra1` region.
- Aktuální veřejné Vercel JSON schema bylo ověřeno pro použité `proxy.entrypoint`, `functions.regions` a stringový `includeFiles` glob. Plný `vercel build` nebylo možné spustit bez platného Vercel účtu/tokenu; tato síťová validace patří do demo deployment gate.
- Produkční i demo build robots metadata: PASS.
- `npm test`: PASS — 20 souborů / 60 testů.
- `npm run build`: PASS.
- `npm run test:migrations`: fresh i upgrade PASS.
- `npm run test:e2e`: 23/23 PASS.
- `git diff --check`: PASS.

Známé výstupní varování zůstává pouze React Router v7 future-flag upozornění.
