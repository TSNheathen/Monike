# Review závislostí — 2026-09-01

Stav: **bez release-blocking critical/high nálezu; 2 moderate nálezy dočasně přijaty**

## Provedené kroky

- `npm audit fix` aktualizoval bezpečně opravitelné závislosti bez změny pevného stacku. Mimo jiné je nyní použit `react-router-dom`/`react-router` 6.30.6, `postcss` 8.5.26 a `undici` 7.29.0.
- `npm audit --omit=dev` po opravě hlásí 0 critical, 0 high, 2 moderate.
- Dostupná automatická oprava zbývajících nálezů vyžaduje breaking přechod na React Router 7.18.3. Taková migrace není pro tento release odůvodněná bez dosažitelné zranitelné cesty.

## Přijaté moderate nálezy

### GHSA-wrjc-x8rr-h8h6 / CVE-2026-53669

Nález se týká neočekávaného externího přesměrování, pokud aplikace předá útočníkem řízenou cestu do React Router `Link`/`navigate`.

Moniké nepředává uživatelský cíl navigace do těchto API:

- veřejné a admin odkazy jsou code-owned nebo vznikají z validovaných slugů CMS labels;
- ID záznamů a slugy se vkládají pouze do pevného interního prefixu;
- alias destination vzniká serverově a route funkce ji přijme pouze proti regexu `/blog/<safe-slug>`;
- dirty-state guard přijímá jen odkaz, který už browser vyhodnotil jako stejný origin, a používá jeho normalizovaný pathname/search/hash.

Výsledek: známý source→sink předpoklad není v aktuální aplikaci dosažitelný. Nález zůstává evidovaný a má se znovu posoudit při přidání uživatelsky řízených redirectů nebo při plánovaném přechodu na React Router 7.

### GHSA-337j-9hxr-rhxg / CVE-2026-53666

Nález se týká `deserializeErrors()` při ruční SSR hydration v React Router Framework/Data mode. Moniké používá deklarativní `BrowserRouter` ve Vite SPA; úzká Vercel article route pouze skládá počáteční HTML metadata a nespouští React Router SSR/hydration ani serializaci router errors.

Výsledek: dotčená funkční cesta v Moniké neexistuje.

## Release podmínka

Před každým demo/production release znovu spustit `npm audit --omit=dev`. Nový critical/high nález nebo změna dosažitelnosti výše uvedených moderate nálezů blokuje release do opravy nebo nového konkrétního posouzení.

Zdroje: [GHSA-wrjc-x8rr-h8h6](https://github.com/advisories/GHSA-wrjc-x8rr-h8h6), [GHSA-337j-9hxr-rhxg](https://github.com/advisories/GHSA-337j-9hxr-rhxg).
