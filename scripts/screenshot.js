const puppeteer = require('puppeteer');

(async () => {
  console.log('Tarayıcı başlatılıyor...');
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  // Console log'ları yakala
  page.on('console', msg => console.log('BROWSER:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  // 1. Login sayfası
  console.log('Login sayfası açılıyor...');
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle0' });

  // 2. Login yap
  console.log('Giriş yapılıyor...');
  await page.type('input[type="email"]', 'demo@demo.com');
  await page.type('input[type="password"]', 'demo123');
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle0' });

  // 3. İlk projeye tıkla
  console.log('Projeye tıklanıyor...');
  try {
    await page.waitForSelector('.cursor-pointer', { timeout: 5000 });
    await page.click('.cursor-pointer');
    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10000 });
  } catch (e) {
    console.log('Proje bulunamadı veya navigation timeout');
  }

  // 4. Board sayfası - tldraw yüklenmesini bekle
  console.log('Board yükleniyor...');
  await new Promise(r => setTimeout(r, 5000));

  // 5. tldraw ile dikdörtgen çiz
  const tldrawContainer = await page.$('.tl-container');
  if (tldrawContainer) {
    const box = await tldrawContainer.boundingBox();
    console.log('tldraw container bulundu:', box);

    // Dikdörtgen aracını seç (R tuşu)
    await page.keyboard.press('r');
    await new Promise(r => setTimeout(r, 500));

    // Dikdörtgen çiz
    const startX = box.x + 400;
    const startY = box.y + 200;
    const endX = box.x + 700;
    const endY = box.y + 400;

    console.log(`Dikdörtgen çiziliyor: (${startX},${startY}) -> (${endX},${endY})`);

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(endX, endY, { steps: 20 });
    await page.mouse.up();

    console.log('Dikdörtgen çizildi!');
  } else {
    console.log('tldraw container bulunamadı!');
  }

  // Kaydetme için bekle (debounce 2sn + API call)
  console.log('Kaydetme bekleniyor (7 saniye)...');
  await new Promise(r => setTimeout(r, 7000));

  // Screenshot al
  await page.screenshot({ path: 'D:/AbeTahta/screenshots/03-board.png' });
  console.log('Board screenshot alındı');

  await browser.close();
  console.log('\nScreenshot: D:/AbeTahta/screenshots/03-board.png');
})();
