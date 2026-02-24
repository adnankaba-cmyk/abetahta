const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1400, height: 900 }
  });

  const page = await browser.newPage();

  // Konsol loglarını yakala
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('BROWSER ERROR:', msg.text());
    }
  });
  page.on('pageerror', err => {
    console.log('PAGE ERROR:', err.message);
  });

  // Board sayfasına git
  console.log('Board sayfasına gidiliyor...');
  await page.goto('http://localhost:3002/board/228bde86-69c7-4df2-a9ee-1bf0753fcb90', { waitUntil: 'networkidle2', timeout: 30000 });

  // 10 saniye bekle - tldraw'un yüklenmesi için
  console.log('Tldraw yüklenmesi bekleniyor (10sn)...');
  await new Promise(r => setTimeout(r, 10000));
  await page.screenshot({ path: 'D:/AbeTahta/test-board-screenshot.png' });
  console.log('Ekran görüntüsü kaydedildi: test-board-screenshot.png');

  // Tldraw canvas yüklendi mi?
  const hasTldraw = await page.evaluate(() => {
    return !!document.querySelector('.tl-container');
  });
  console.log('Tldraw canvas yüklendi:', hasTldraw);

  // DSL butonu var mı?
  const hasDSLButton = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('DSL'));
  });
  console.log('DSL butonu var:', hasDSLButton);

  // AI butonu var mı?
  const hasAIButton = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('AI'));
  });
  console.log('AI butonu var:', hasAIButton);

  // Timeline butonu var mı?
  const hasTimelineButton = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('Timeline'));
  });
  console.log('Timeline butonu var:', hasTimelineButton);

  // Bağlantı durumu
  const connectionStatus = await page.evaluate(() => {
    const el = document.body.innerText;
    if (el.includes('Canlı')) return 'Canlı';
    if (el.includes('Bağlantı yok')) return 'Bağlantı yok';
    return 'Bilinmiyor';
  });
  console.log('Bağlantı durumu:', connectionStatus);

  console.log('\nTest tamamlandı. Tarayıcı 10 saniye açık kalacak...');
  await new Promise(r => setTimeout(r, 10000));

  await browser.close();
})();
