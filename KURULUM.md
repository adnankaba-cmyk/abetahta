# abeTahta Ajan Sistemi — Kurulum ve Kullanım

## Hızlı Kurulum

Bu dosyaları abeTahta proje kök dizinine kopyalayın:

```
D:\AbeTahta\
├── CLAUDE.md                          ← Ana kural dosyası (kopyala)
├── .claude/
│   ├── agents/
│   │   ├── gelistirici.md             ← Kod yazma ajanı
│   │   ├── test-muhendisi.md          ← Test ajanı
│   │   ├── hata-ayiklayici.md         ← Debug ajanı
│   │   ├── kod-inceleyici.md          ← İnceleme ajanı
│   │   ├── db-uzman.md                ← Veritabanı ajanı
│   │   ├── kalite-gardiyan.md         ← Son kapı ajanı
│   │   └── proje-takipci.md           ← İlerleme takip ajanı
│   └── logs/
│       └── changelog.md               ← Değişiklik günlüğü
```

## Windows'da Kurulum Komutu

PowerShell'de:
```powershell
cd D:\AbeTahta
mkdir -Force .claude\agents
mkdir -Force .claude\logs

# Dosyaları indirdiğiniz konumdan kopyalayın:
# CLAUDE.md → D:\AbeTahta\CLAUDE.md
# .claude\agents\*.md → D:\AbeTahta\.claude\agents\
# .claude\logs\changelog.md → D:\AbeTahta\.claude\logs\
```

## Ajanlar ve Görevleri

| Ajan | Tetiklenme | Ne Yapar |
|------|-----------|----------|
| **gelistirici** | Kod yazma/değiştirme görevi | Yazar → Okur → Build → Test → Log |
| **test-muhendisi** | Kod değişikliği sonrası | Test çalıştırır → Başarısızları düzeltir → Rapor |
| **hata-ayiklayici** | Hata/bug raporu | Kök neden bulur → Düzeltir → Doğrular → Regresyon testi |
| **kod-inceleyici** | Kod değişikliği sonrası | İnceler → Sorunları bulur → Rapor |
| **db-uzman** | Veritabanı görevi | Şema analizi → Migration → Test → Log |
| **kalite-gardiyan** | Her görev sonunda | Her şeyi doğrular → Geçiş verir/reddeder |
| **proje-takipci** | Oturum başı/sonu | Durum raporu → İlerleme → Tıkanıklık tespiti |

## Tipik İş Akışı

```
1. Oturum başında:
   "proje-takipci ile durum raporu ver"

2. Görev sırasında:
   "login sayfasına validasyon ekle"
   → Claude otomatik olarak 'gelistirici' ajanını çağırır
   → gelistirici: kod yazar, test eder, log tutar

3. Doğrulama:
   → Claude otomatik olarak 'test-muhendisi' ve 'kod-inceleyici' çağırır
   
4. Son kapı:
   "kalite-gardiyan ile son kontrolü yap"
   → Her şey doğrulanır, geçiş verilir veya eksikler listelenir

5. Oturum sonunda:
   "proje-takipci ile oturum özeti yaz"
```

## Önemli Kurallar

1. **Hiçbir iş kanıtlanmadan "bitti" sayılmaz**
2. **Her değişiklik test edilir**
3. **Her iş changelog'a yazılır**
4. **Önce-sonra karşılaştırması zorunludur**
5. **Kalite gardiyanından geçemeyen iş merge edilemez**
