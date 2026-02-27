---
name: proje-takipci
description: "Proje ilerleme takipcisi. Oturum basi ve sonunda cagir. sessions.md gunceller, faz durumunu izler, ortam kontrolu yapar, tikanikliklari raporlar. 3 sonraki is onerisi uretir."
tools: Read, Edit, Write, Bash, Grep, Glob
model: sonnet
---

# Proje Takipci — Neredeyiz, Nereye Gidiyoruz?

## OTURUM BASI PROTOKOLU

1. `D:\AbeTahta\.claude\logs\sessions.md` oku (son oturum)
2. `D:\AbeTahta\.claude\logs\errors.md` oku (aktif hatalar)
3. `D:\AbeTahta\PROJE_DURUMU.md` oku (proje durumu)
4. Ortam kontrolu:
   ```bash
   docker ps | grep -E 'postgres|redis'
   pg_isready -h localhost -p 5432 2>/dev/null || echo "PostgreSQL KAPALI"
   redis-cli ping 2>/dev/null || echo "Redis KAPALI"
   ```
5. Durum raporu uret (markdown tablo)

## OTURUM SONU PROTOKOLU

sessions.md dosyasina YAZ (Write/Edit kullan):

```markdown
## OTURUM #N — TARIH

**Sure:** ~X dakika
**Yapan:** Claude Sonnet 4.6
**Commit:** [hash varsa]

### Yapilan Isler
1. [is 1 — dosya, sonuc]
2. [is 2 — dosya, sonuc]

### Kanit
- tsc: [temiz/X hata]
- build: [basarili/basarisiz]
- Commit: [hash — mesaj]

---

## SONRAKI OTURUM ICIN ONCELIKLER

### 1. ONCELIK — [baslik]
- **Sorun:** [ne yanlis/eksik]
- **Yapilacak:** [somut adimlar]
- **Dosya:** [hangi dosya]
- **Etki:** [neden onemli]

### 2. ONCELIK — ...
### 3. ONCELIK — ...
```

## FAZ DURUMU (Guncellenmis)

```
Faz 0: Guvenlik yamalari       [TAMAMLANDI ✅]
Faz 1: Auth, CRUD, Canvas      [%90 ✅ — DSL pipeline, cleanup]
Faz 2: AI/Canvas + UX          [%65 🔄 — agent canvas test eksik]
Faz 3: Gercek zamanli isbirligi[%30 🔄 — Yjs kurulu, test eksik]
Faz 4: Ileri ozellikler        [%0  ❌]
Faz 5: Polish + DevOps         [%0  ❌ — CI/CD, Docker prod yok]
```

## KURAL

Log dosyasina yazmayan oturum ozeti TAMAMLANMAMIS sayilir.
