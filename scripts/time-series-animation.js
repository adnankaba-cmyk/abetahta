const puppeteer = require('puppeteer');

// Zaman serisi verisi - Aylık satış verileri
const timeSeriesData = [
  { ay: 'Ocak', deger: 120, renk: '#3B82F6' },
  { ay: 'Subat', deger: 150, renk: '#10B981' },
  { ay: 'Mart', deger: 180, renk: '#F59E0B' },
  { ay: 'Nisan', deger: 140, renk: '#EF4444' },
  { ay: 'Mayis', deger: 200, renk: '#8B5CF6' },
  { ay: 'Haziran', deger: 250, renk: '#EC4899' },
];

(async () => {
  console.log('Tarayıcı başlatılıyor...');
  const browser = await puppeteer.launch({ headless: false }); // Görünür mod
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  page.on('console', msg => {
    if (msg.text().includes('tldraw') || msg.text().includes('Yeni nesne')) {
      console.log('BROWSER:', msg.text());
    }
  });

  // Login
  console.log('Login yapılıyor...');
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle0' });
  await page.type('input[type="email"]', 'demo@demo.com');
  await page.type('input[type="password"]', 'demo123');
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle0' });

  // Projeye tıkla
  try {
    await page.waitForSelector('.cursor-pointer', { timeout: 5000 });
    await page.click('.cursor-pointer');
    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10000 });
  } catch (e) {}

  // tldraw yüklensin
  await new Promise(r => setTimeout(r, 4000));

  const box = await (await page.$('.tl-container')).boundingBox();
  console.log('\n=== ZAMAN SERİSİ ANİMASYONU BAŞLIYOR ===\n');

  // Başlık ekle
  console.log('Başlık ekleniyor...');
  await page.keyboard.press('t');
  await new Promise(r => setTimeout(r, 200));
  await page.mouse.click(box.x + 400, box.y + 100);
  await new Promise(r => setTimeout(r, 200));
  await page.keyboard.type('2024 AYLIK SATIS GRAFIGI', { delay: 30 });
  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 1000));

  // Her ay için bar çiz - animasyonlu
  const startX = box.x + 150;
  const baseY = box.y + 500;
  const barWidth = 80;
  const spacing = 100;
  const scale = 1.5; // Yükseklik çarpanı

  for (let i = 0; i < timeSeriesData.length; i++) {
    const data = timeSeriesData[i];
    const x = startX + i * spacing;
    const barHeight = data.deger * scale;

    console.log(`[${i + 1}/${timeSeriesData.length}] ${data.ay}: ${data.deger} birim ekleniyor...`);

    // Bar (dikdörtgen) çiz
    await page.keyboard.press('r');
    await new Promise(r => setTimeout(r, 200));

    await page.mouse.move(x, baseY - barHeight);
    await page.mouse.down();
    await page.mouse.move(x + barWidth, baseY, { steps: 15 });
    await page.mouse.up();
    await new Promise(r => setTimeout(r, 300));

    // Ay etiketi
    await page.keyboard.press('t');
    await new Promise(r => setTimeout(r, 200));
    await page.mouse.click(x + barWidth / 2, baseY + 25);
    await new Promise(r => setTimeout(r, 150));
    await page.keyboard.type(data.ay, { delay: 30 });
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 200));

    // Değer etiketi (bar üstünde)
    await page.keyboard.press('t');
    await new Promise(r => setTimeout(r, 200));
    await page.mouse.click(x + barWidth / 2, baseY - barHeight - 20);
    await new Promise(r => setTimeout(r, 150));
    await page.keyboard.type(data.deger.toString(), { delay: 30 });
    await page.keyboard.press('Escape');

    // Animasyon etkisi için bekle
    await new Promise(r => setTimeout(r, 800));

    console.log(`   ✓ ${data.ay} eklendi`);
  }

  // Trend çizgisi ekle
  console.log('\nTrend çizgisi ekleniyor...');
  await page.keyboard.press('a'); // Arrow/line tool
  await new Promise(r => setTimeout(r, 300));

  // İlk noktadan son noktaya trend çizgisi
  const firstX = startX + barWidth / 2;
  const firstY = baseY - timeSeriesData[0].deger * scale;
  const lastX = startX + (timeSeriesData.length - 1) * spacing + barWidth / 2;
  const lastY = baseY - timeSeriesData[timeSeriesData.length - 1].deger * scale;

  await page.mouse.move(firstX, firstY);
  await page.mouse.down();
  await page.mouse.move(lastX, lastY, { steps: 30 });
  await page.mouse.up();
  await new Promise(r => setTimeout(r, 500));

  // Özet notu ekle
  console.log('Özet notu ekleniyor...');
  await page.keyboard.press('n'); // Note tool
  await new Promise(r => setTimeout(r, 300));
  await page.mouse.click(box.x + 800, box.y + 200);
  await new Promise(r => setTimeout(r, 300));

  const toplamSatis = timeSeriesData.reduce((sum, d) => sum + d.deger, 0);
  const ortSatis = Math.round(toplamSatis / timeSeriesData.length);
  const maxAy = timeSeriesData.reduce((max, d) => d.deger > max.deger ? d : max);

  await page.keyboard.type(`OZET\n\nToplam: ${toplamSatis}\nOrtalama: ${ortSatis}\nEn Yuksek: ${maxAy.ay} (${maxAy.deger})`, { delay: 20 });
  await page.keyboard.press('Escape');

  // Kaydetmeyi bekle
  console.log('\n=== Kaydetme bekleniyor (5 saniye) ===');
  await new Promise(r => setTimeout(r, 5000));

  // Screenshot al
  await page.screenshot({ path: 'D:/AbeTahta/screenshots/06-time-series.png' });
  console.log('\n✓ Screenshot alındı: D:/AbeTahta/screenshots/06-time-series.png');

  console.log('\n10 saniye görüntüleme...');
  await new Promise(r => setTimeout(r, 10000));

  await browser.close();
  console.log('\n=== TAMAMLANDI ===');
})();
