# Phase 6 — manuální accessibility QA

Stav: **DOBROVOLNÉ NEBLOKUJÍCÍ DOPORUČENÍ**

Tento dokument je pomůcka pro budoucí praktické ověření, ne release gate ani požadavek na formální certifikaci. Automatické Playwright/axe, keyboard a reflow testy jsou evidované v `phase-6.md` a pro současný single-owner osobní web tvoří přijatý release základ.

## Testovací prostředí

- Datum:
- Tester:
- Windows verze:
- NVDA verze:
- Firefox/Chrome verze:
- iOS/iPadOS + VoiceOver + Safari verze, případně zdůvodněná náhrada macOS VoiceOver + Safari:
- Testovaný commit a deployment URL:

## Responsive a zoom

- [ ] 360×800, 390×844, 759/760, 1099/1100 a 1440 CSS px bez ztráty funkcí a page-level overflow.
- [ ] 200% zoom/text resize bez oříznutých popisků, překrytých controls nebo nedostupných akcí.
- [ ] 1280 CSS px při 400% zoomu (320px ekvivalent) bez nepovoleného dvourozměrného scrollování.
- [ ] Focus není zakrytý sticky UI; mobilní dialogy a action rows zůstávají dosažitelné.
- [ ] Reduced motion odstraní/redukuje nepodstatné přechody včetně draweru, dialogu a lightboxu.

## Keyboard — public

- [ ] `/`: skip link, navigace, CTA, pět karet, sociální odkazy a mobilní drawer.
- [ ] `/blog`: labels, článek, empty/error retry; validní i neplatný label.
- [ ] `/blog/:slug`: canonical obsah, chips, rich text, návrat; samostatně 404 a 503.
- [ ] `/gallery`: všechny položky, open/previous/next/Escape/close a přesný focus return.
- [ ] `/o-mne`, `/kontakt` a neznámá 404 bez keyboard dead end.

## Keyboard — admin

- [ ] Login, navigace a mobilní drawer.
- [ ] Blog new/draft/edit, labels, slug/history, publish/unpublish/delete a dirty confirm.
- [ ] Tiptap formátování a inline obrázek insert/edit/remove včetně všech atributů.
- [ ] Cover upload/replace/remove, upload failure/retry a save failure/retry.
- [ ] Auth-expiry re-login a conflict stav bez ztráty lokální práce.
- [ ] Galerie create/edit/publish/unpublish/delete; reorder pouze Move Up/Down a save.
- [ ] Landing, About portrait/rich text a Contact editace.

## Screen reader — Windows + NVDA

- [ ] Public routes a celý desktop admin authoring průchod.
- [ ] Landmarks/headings, názvy controls a route-change context jsou srozumitelné.
- [ ] Dialogy jsou oznámené a background se v modalu neprochází.
- [ ] Status/error/validation/reorder oznámení přicházejí právě jednou a ve správný čas.
- [ ] Meaningful alt se čte, dekorativní obrázky se přeskakují.

## Screen reader — VoiceOver + Safari

- [ ] Public mobilní navigace a lightbox.
- [ ] Core mobilní admin drawer, forms, dialogs a gallery reorder.
- [ ] Focus return, rotor/heading navigace a live announcements jsou srozumitelné.

## Výsledek

- [ ] Bez zásadního praktického problému.
- [ ] Nalezen problém k běžné opravě — níže je route, postup, očekávání, skutečnost a AT/browser verze.

Nálezy:
