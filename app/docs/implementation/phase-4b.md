# Phase 4B — owner CMS

Stav: **PASS**

## Implementovaný rozsah

- Blog má skutečný admin seznam a úplný cyklus koncept → publikace → skrytí → opětovná publikace → trvalé smazání.
- Uložení článku posílá pouze canonical `content_json`; HTML zůstává výhradně serverovým cache výstupem.
- Slug změny zobrazují varování a historii, kolize/stale write jsou viditelné a nepřepisují lokální formulář.
- Sdílený Article/About Tiptap je omezený na schema z issue #18, včetně přesného toolbaru, link policy, normalizace paste a dvou úrovní seznamu.
- Inline assety se stageují až k existujícímu parentu, lze je vložit/upravit/odebrat a save transakce rozhoduje o aktivaci.
- Blog cover, galerie, landing karty a About portrét procházejí browser normalizací: orientovaný re-encode bez zdrojových metadat, max. 4096 px, JPEG 0,90, PNG alpha, WebP → JPEG/PNG.
- Galerie má CRUD, publikaci, alt gate, replace, delete a transakční pořadí s viditelnými tlačítky nahoru/dolů.
- Pevné editory pokrývají Landing page, O mně a Kontakt bez page builderu a bez autosave.
- Admin čtení nemají fixture fallback. Auth expiry vyvolá in-place reauth bez automatického opakování write; dirty link navigation a `beforeunload` chrání rozepsané změny.
- Aktivní inline asset je veřejný jen přes publikovaný post nebo About singleton; neaktivní/draft asset zůstává chráněný.

## Ověření exit condition

- Vitest: 19 souborů / 50 testů.
- Fresh a upgrade migrace: PASS.
- Playwright: 23/23; kompletní blog lifecycle s coverem a inline assetem, slug change/reclaim, hide/republish/delete, auth expiry, stale conflict, dirty dialog, galerie, všechny statické editory a admin axe.
- Produkční Vite build: PASS.
- `git diff --check`: PASS.

Známé výstupní varování je pouze React Router v7 future-flag upozornění. Závislostní audit zůstává samostatným release/security gatem pozdější fáze; aktuální report obsahuje transitive `linkify-it` a React Router advisories, které je nutné před produkčním gate buď aktualizovat bez porušení pevného stacku, nebo doložit jako nedosažitelné podle issue #16/#17.
