# Phase 6 — hardening, performance a přístupnost

Stav: **PASS PRO PRAKTICKÝ DEMO RELEASE** (2026-09-02)

Praktický accessibility scope je splněný automatickými a browserovými kontrolami níže. Dobrovolný keyboard/NVDA/VoiceOver průchod v `qa/phase-6-manual-accessibility.md` zůstává užitečným doporučením pro pozdější zlepšení, ale neblokuje demo ani production release.

## Automaticky ověřeno

- Přesné CORS allowlisty, PocketBase rate limit 5 auth pokusů/minutu, filter-injection payloady a rich-text XSS vstupy.
- Ochrana draft/inactive souborů a cache přechod `private,no-store` → veřejná dlouhá cache po publikaci.
- Raster-only upload validace, decoded rozměry a serverový strop 4096 px i při obejití browserové normalizace.
- Public/admin keyboard cesty, skip link, focus return, dialog/drawer, Tiptap a Move Up/Down alternativa k drag-and-drop.
- Axe na reprezentativních public/admin stavech, viewport/reflow/200% text a reduced-motion kontrakt.
- Role-specific responsive image kandidáti, lazy lightbox load, intrinsic rozměry a CLS rozpočet.
- Dependency gate: 0 critical, 0 high; dva moderate React Router nálezy mají zdokumentovanou nedosažitelnost v `security/dependency-review-2026-09-01.md`.

## Aktuální green gate

- `npm test`: 22 souborů / 78 testů PASS.
- `npm run build`: PASS.
- `npm run test:migrations`: fresh i upgrade PASS.
- `npm run test:e2e`: 42/42 PASS.
- Docker/PocketBase integrační smoke z Phase 7: fresh bootstrap, migrace, readiness, runtime UID a nastavení PASS.

Známý nezávadný výstup je pouze React Router v7 future-flag upozornění.

## Doporučené neblokující ruční ověření

- reálný průchod na 360/390/760/1100/1440 px, 200% text a 320px ekvivalentu;
- kompletní public/admin keyboard-only průchod;
- NVDA na Windows;
- VoiceOver se Safari;
- záznam verzí, výsledků a případných vad do dobrovolného checklistu.
