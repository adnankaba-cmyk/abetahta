const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  // Login
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

  // Note aracını seç (N tuşu)
  await page.keyboard.press('n');
  await new Promise(r => setTimeout(r, 300));

  // OLDU notunun altına yeni not ekle (sağ tarafta, biraz aşağıda)
  const box = await (await page.$('.tl-container')).boundingBox();
  await page.mouse.click(box.x + 1120, box.y + 450);
  await new Promise(r => setTimeout(r, 300));

  // Yazı yaz
  await page.keyboard.type('NE OLDU', { delay: 50 });
  await page.keyboard.press('Escape');

  // Kaydet
  await new Promise(r => setTimeout(r, 3000));
  console.log('Not eklendi, kaydediliyor...');

  await browser.close();
})();
