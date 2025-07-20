const puppeteer = require('puppeteer');
const files = [
  'ca90days.html',
  'criticalasset.html',
  'lawenforcement.html',
  'spec.html',
  'spec2.html',
  'thingstodo.html'
];

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  for (const file of files) {
    const filePath = `file://${__dirname}/${file}`;
    await page.goto(filePath);
    await page.screenshot({ path: `${file.replace('.html', '_preview.png')}`, fullPage: true });
  }

  await browser.close();
})();