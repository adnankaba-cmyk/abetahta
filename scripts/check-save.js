const puppeteer = require('puppeteer');

(async () => {
  console.log('Kayıt kontrolü - tarayıcı başlatılıyor...');
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
  } catch (e) {
    console.log('Proje bulunamadı');
  }

  // Board yüklenmesini bekle
  console.log('Board yükleniyor...');
  await new Promise(r => setTimeout(r, 5000));

  // Screenshot al
  await page.screenshot({ path: 'D:/AbeTahta/screenshots/04-kayit-kontrol.png' });
  console.log('Kayıt kontrol screenshot alındı');

  await browser.close();
})();
