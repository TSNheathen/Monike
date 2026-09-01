# PocketBase 0.40.1 multi-select membership

Stav: **reprodukovatelný implementační blocker smluveného operátoru; behaviorální kontrakt zachován**

Issue #6 zapisuje očekávaný validní filter jako:

```text
published = true && categories ?= "<validated-key>"
```

Na pinovaném PocketBase serveru `0.40.1` byl proti skutečnému `SelectField(maxSelect: 4)` záznamu s hodnotou `categories = ["cesty"]` spuštěn tento minimální test:

```text
published = true && categories:length > 0                         -> 1 záznam
published = true && categories:length > 0 && categories ?= 'cesty' -> 0 záznamů
published = true && categories:length > 0 && categories ~ 'cesty'  -> 1 záznam
```

Operátor `?=` tedy v cílové verzi neimplementuje očekávanou membership semantiku pro tento multi-select, přestože je tak popsán v plánovacím ticketu. Doslovná implementace by porušila důležitější behaviorální smlouvu: článek se musí objevit v každé přiřazené kategorii.

Implementace proto používá:

```text
published = true && categories:length > 0 && categories ~ {:category}
```

Hodnota je před sestavením filtru přijata pouze z pevného čtyřprvkového registru a je vložena přes `pb.filter` parameter binding. Nejde o volný substring z URL. Čtyři stabilní klíče se navzájem nepřekrývají, takže tento výraz na uzavřeném enumu zachovává požadovanou membership semantiku.

Integrační browser test proti PocketBase 0.40.1 ověřuje, že `/blog?category=cesty` vrací článek uložený s `categories = ["cesty"]`; unit test dál ověřuje odmítnutí neplatné hodnoty před konstrukcí filtru a parameter binding.
