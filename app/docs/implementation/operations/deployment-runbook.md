# Moniké deployment a recovery runbook

Tento runbook provádí issue #11/#17. Demo se dokončí první; produkce dostane přesně stejný otestovaný image digest a Git commit.

## 1. Jednorázové prostředky

Pro každé prostředí samostatně vytvoř:

- Fly App v `fra`, jeden 5GB encrypted Volume a custom HTTPS API hostname;
- Vercel project s Root Directory `app/` a stabilní frontend doménou;
- private Cloudflare R2 Standard bucket a bucket-scoped key;
- unikátní `PB_ENCRYPTION_KEY`, `_superusers` credential a normální `admins` credential.

Volitelně lze přidat jednoduchý externí uptime check `/api/health/ready` a heartbeat URL pro backup/cleanup/storage. Aplikace je nevyžaduje a jejich absence neblokuje start ani release.

Demo a production nesdílí App, Volume, doménu, bucket, key, encryption key, účet ani deployment token. Pokud jsou konceptuální Fly názvy už obsazené, změň `app` ve správném TOML na jednoznačný globálně unikátní název; identitu prostředí v názvu zachovej.

Volume názvy musí odpovídat `source` v TOML. Vytvoř je v `fra`, 5 GB, se snapshot retencí 7 dní demo / 14 dní production. Po vytvoření vynucuj jeden Machine; nepovoluj autostop ani scale-to-zero.

## 2. Fly konfigurace

Před prvním startem vlož do environment-scoped Fly secret/config storage tyto hodnoty. Hodnoty nepatří do Git, shell history ani logu:

| Název | Hodnota |
| --- | --- |
| `MONIKE_PUBLIC_POCKETBASE_URL` | přesný backend HTTPS origin |
| `MONIKE_ALLOWED_ORIGINS` | přesný frontend HTTPS origin; bez wildcard |
| `MONIKE_SUPERUSER_IPS` | aktuální důvěryhodný operator IP/CIDR, typicky `/32` |
| `PB_ENCRYPTION_KEY` | náhodných přesně 32 znaků |
| `MONIKE_R2_ENDPOINT` | přesný account R2 HTTPS origin |
| `MONIKE_R2_BUCKET` | environment-specific private bucket |
| `MONIKE_R2_REGION` | R2 region hodnota, obvykle `auto` |
| `MONIKE_R2_ACCESS_KEY_ID` | environment-specific scoped key |
| `MONIKE_R2_SECRET_ACCESS_KEY` | environment-specific scoped secret |
| `MONIKE_BACKUP_HEARTBEAT_URL` | volitelná tajná heartbeat URL |
| `MONIKE_CLEANUP_HEARTBEAT_URL` | volitelná tajná heartbeat URL |
| `MONIKE_STORAGE_HEARTBEAT_URL` | volitelná tajná heartbeat URL |

`APP_ENV`, `MONIKE_ENV` a `GOMEMLIMIT` jsou v TOML. Pro první HSTS rollout může zůstat `MONIKE_API_HSTS_MAX_AGE` nenastavené (default 300); `MONIKE_API_HSTS_INCLUDE_SUBDOMAINS` musí zůstat vypnuté.

Entrypoint konfiguraci validuje a bootstrap ji zapisuje do PocketBase settings. Chybějící kritická hodnota musí start zastavit a readiness nesmí projít. Heartbeat hodnoty jsou nepovinné; pokud existují, musí být HTTPS.

## 3. Build a immutable image

Z čistého release commitu v `app/`:

```bash
npm ci
npm test
npm run build
npm run test:migrations
npm run test:e2e
npm run test:image
npm audit --omit=dev
docker build --file Dockerfile.pocketbase --tag monike-pocketbase:release .
```

Release tag má tvar `pb-0.40.1-g<12-char-sha>`. Po přihlášení do Fly registry přetaguj lokální image na `registry.fly.io/<demo-app>/<release-tag>`, pushni jej a zaznamenej výsledný digest. Nepoužívej `latest` ani znovu nestav production image.

## 4. Demo deploy

1. Ověř, že config míří na demo App a demo Volume.
2. Deployni backend image podle immutable tagu/digestu s `fly.demo.toml`.
3. Počkej na `/api/health/live` i `/api/health/ready`; zkontroluj migrace, runtime log a přesně jeden běžící Machine.
4. První `_superusers` vytvoř přes Fly console příkazem PocketBase `superuser upsert` nad `/pb/pb_data`; vždy přidej `--encryptionEnv=PB_ENCRYPTION_KEY`. Credential má 20+ znaků a uloží se jen do password manageru.
5. Přes `_superusers` cestu vytvoř právě jeden normální `admins` owner účet s jiným heslem. Moniké `/admin` nikdy nepoužívá `_superusers`.
6. Ověř Dashboard allowlist z povolené i nepovolené IP a `hideControls=true`.
7. V demo Vercel projektu nastav `VITE_APP_ENV=demo`, přesné `VITE_POCKETBASE_URL`, `VITE_SITE_URL`, jejich server-only protějšky `MONIKE_ENV`, `MONIKE_POCKETBASE_URL`, `MONIKE_SITE_URL` a `MONIKE_HSTS_MAX_AGE=300`. Sample/fixture flag nesmí existovat nebo být true.
8. Deployni stejný Git commit. Ověř globální `noindex,nofollow`, CSP a routing 200/308/404/503.
9. Data doplň přes migrace a normální admin workflow. Frontend fixtures nejsou seed ani fallback.
10. Proveď krátký smoke hlavních public/admin toků a jeden backup/restore drill.

## 5. Backup a restore drill

- PocketBase cron: 02:15 UTC, demo 14 / production 30 rotujících záloh v odděleném private R2 bucketu.
- Fly snapshots: demo 7 / production 14 dní.
- Cleanup: 03:30 UTC po backup okně; inactive asset musí být starší než sedm dní a při nejistotě se nemaže.
- Storage heartbeat se odešle pouze při zapisovatelném Volume, využití pod 80 % a alespoň 1 GB volného místa.

Restore PASS vyžaduje dočasnou izolovanou Fly App ve `fra`, fresh Volume minimálně stejné velikosti, odpovídající encryption key, kompatibilní immutable image a restore-capable R2 credential. Po obnově ověř migration head, počty/representative records, public i protected soubor, custom route, rich text, admin recovery a regeneraci alespoň jednoho smazaného thumbu. Výsledek zaznamenej a dočasný App/Volume až potom zruš.

Demo drill je měsíční, production čtvrtletní. Neověřená existence R2 objektu není restore PASS.

## 6. Production promotion

Před produkcí musí být zelené automatické testy a ověřený funkční demo deployment. Ruční NVDA/VoiceOver checklist je doporučení, nikoli gate.

1. Ověř poslední backup a kapacitu; pro migration/write-path release vytvoř named predeploy PocketBase backup a u rizikové změny on-demand Fly snapshot.
2. Zaznamenej současný backend digest, migration head a Vercel deployment.
3. Deployni do production přesně demo-tested image digest s `fly.production.toml`.
4. Po backend readiness proveď auth/rules/upload/protected-file/CORS/rate/custom-route smoke.
5. Až potom deployni production Vercel project ze stejného commitu s production-only URLs/secrets.
6. Proveď public/admin/HTTP metadata/header smoke a zkontroluj backup. Pokud jsou nakonfigurované volitelné monitory, ověř i je.

## 7. HSTS postup

Site i API začnou na `max-age=300` bez `includeSubDomains`. Po několika dnech stabilních certifikátů/DNS nastav obě max-age hodnoty na `31536000`. `MONIKE_HSTS_INCLUDE_SUBDOMAINS=true` a `MONIKE_API_HSTS_INCLUDE_SUBDOMAINS=true` zapni pouze pokud jsou všechny relevantní subdomény HTTPS-safe. Preload se ve v1 nepoužívá.

## 8. Rollback a incident

- Frontend regression: vrať předchozí Vercel deployment; backend zůstává.
- Backend bez nekompatibilní migrace: vrať předchozí immutable image digest.
- Destruktivní/nekompatibilní schema nebo poškozená data: nepřepisuj jediný poškozený Volume. Preferuj forward fix nebo restore predeploy/R2 backup do fresh Volume; starou kopii zachovej pro recovery analýzu.
- Chybějící heartbeat: zkontroluj PocketBase/Fly log, R2 spojení nebo capacity/write probe bez vypsání URL či credentialu.
- Zaplnění >=80 % je alert; >=90 % nebo méně než 1 GB volného místa blokuje backup/rizikový deploy. Volume zvětši, nemaž automaticky produkční média.
- Kompromitované owner credentials zneplatni serverově, zkontroluj obsah/logy a rotuj dotčené secrets. Skrytí `/admin` není containment.
