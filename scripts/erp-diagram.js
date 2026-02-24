const puppeteer = require('puppeteer');

(async () => {
  console.log('Tarayıcı başlatılıyor...');
  const browser = await puppeteer.launch({ headless: false }); // Görünür modda
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  // Console log'ları yakala
  page.on('console', msg => console.log('BROWSER:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  // 1. Login
  console.log('Login yapılıyor...');
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle0' });
  await page.type('input[type="email"]', 'demo@demo.com');
  await page.type('input[type="password"]', 'demo123');
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle0' });

  // 2. Projeye tıkla
  console.log('Projeye tıklanıyor...');
  try {
    await page.waitForSelector('.cursor-pointer', { timeout: 5000 });
    await page.click('.cursor-pointer');
    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10000 });
  } catch (e) {
    console.log('Proje bulunamadı');
  }

  // 3. tldraw yüklenmesini bekle
  console.log('Board yükleniyor...');
  await new Promise(r => setTimeout(r, 4000));

  const tldrawContainer = await page.$('.tl-container');
  if (!tldrawContainer) {
    console.log('tldraw container bulunamadı!');
    await browser.close();
    return;
  }

  const box = await tldrawContainer.boundingBox();
  console.log('Canvas hazır, ERP diagramı çiziliyor...');

  // ====== ERP BAŞLIK ======
  // Text aracını seç (T tuşu)
  await page.keyboard.press('t');
  await new Promise(r => setTimeout(r, 300));

  // Başlık için tıkla ve yaz
  await page.mouse.click(box.x + 960, box.y + 80);
  await new Promise(r => setTimeout(r, 200));
  await page.keyboard.type('ERP NEDIR?', { delay: 50 });
  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 300));

  // ====== MERKEZ KUTU - ERP ======
  await page.keyboard.press('r'); // Rectangle
  await new Promise(r => setTimeout(r, 300));

  // Merkez ERP kutusu
  const centerX = box.x + 960;
  const centerY = box.y + 350;
  await page.mouse.move(centerX - 80, centerY - 40);
  await page.mouse.down();
  await page.mouse.move(centerX + 80, centerY + 40, { steps: 10 });
  await page.mouse.up();
  await new Promise(r => setTimeout(r, 200));

  // ERP yazısı
  await page.keyboard.press('t');
  await new Promise(r => setTimeout(r, 200));
  await page.mouse.click(centerX, centerY);
  await new Promise(r => setTimeout(r, 200));
  await page.keyboard.type('ERP', { delay: 50 });
  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 300));

  // ====== MODÜLLER ======
  const modules = [
    { x: centerX - 350, y: centerY - 200, name: 'FINANS' },
    { x: centerX, y: centerY - 200, name: 'MUHASEBE' },
    { x: centerX + 350, y: centerY - 200, name: 'SATIS' },
    { x: centerX - 350, y: centerY + 200, name: 'STOK' },
    { x: centerX, y: centerY + 200, name: 'URETIM' },
    { x: centerX + 350, y: centerY + 200, name: 'IK' },
  ];

  for (const mod of modules) {
    // Kutu çiz
    await page.keyboard.press('r');
    await new Promise(r => setTimeout(r, 200));
    await page.mouse.move(mod.x - 60, mod.y - 30);
    await page.mouse.down();
    await page.mouse.move(mod.x + 60, mod.y + 30, { steps: 10 });
    await page.mouse.up();
    await new Promise(r => setTimeout(r, 150));

    // İsim yaz
    await page.keyboard.press('t');
    await new Promise(r => setTimeout(r, 150));
    await page.mouse.click(mod.x, mod.y);
    await new Promise(r => setTimeout(r, 150));
    await page.keyboard.type(mod.name, { delay: 30 });
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 200));
  }

  // ====== OKLAR - Merkeze bağla ======
  await page.keyboard.press('a'); // Arrow tool
  await new Promise(r => setTimeout(r, 300));

  for (const mod of modules) {
    // Modülden merkeze ok çiz
    const startX = mod.y < centerY ? mod.x : mod.x;
    const startY = mod.y < centerY ? mod.y + 30 : mod.y - 30;
    const endX = centerX;
    const endY = mod.y < centerY ? centerY - 40 : centerY + 40;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(endX, endY, { steps: 15 });
    await page.mouse.up();
    await new Promise(r => setTimeout(r, 150));
  }

  // ====== ALT AÇIKLAMA ======
  await page.keyboard.press('t');
  await new Promise(r => setTimeout(r, 200));
  await page.mouse.click(box.x + 960, box.y + 600);
  await new Promise(r => setTimeout(r, 200));
  await page.keyboard.type('Enterprise Resource Planning - Kurumsal Kaynak Planlamasi', { delay: 30 });
  await page.keyboard.press('Escape');

  // Kaydetmeyi bekle
  console.log('Kaydetme bekleniyor (5 saniye)...');
  await new Promise(r => setTimeout(r, 5000));

  // Screenshot al
  await page.screenshot({ path: 'D:/AbeTahta/screenshots/05-erp-diagram.png' });
  console.log('ERP diagram screenshot alındı');

  console.log('\n10 saniye görüntüleme...');
  await new Promise(r => setTimeout(r, 10000));

  await browser.close();
  console.log('\nScreenshot: D:/AbeTahta/screenshots/05-erp-diagram.png');
})();
