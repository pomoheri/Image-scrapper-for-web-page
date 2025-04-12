const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// === Helper: download file dari URL ===
function downloadImage(url, filepath) {
  const protocol = url.startsWith('https') ? https : http;

  return new Promise((resolve, reject) => {
    protocol.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Gagal download ${url}: Status ${res.statusCode}`));
        return;
      }

      const fileStream = fs.createWriteStream(filepath);
      res.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close(resolve);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

// === Setup Argumen ===
const urlTarget = process.argv[2] || 'https://macanan.co.id/';
const downloadDir = path.join(__dirname, 'downloads');

// Pastikan folder `downloads/` ada
if (!fs.existsSync(downloadDir)) {
  fs.mkdirSync(downloadDir);
}

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  console.log(`🔗 Opening page: ${urlTarget}`);
  await page.goto(urlTarget, { waitUntil: 'networkidle2' });

  console.log("✅ Page loaded. Scraping images...");

  const imgSource = await page.evaluate(() => {
    const baseUrl = location.origin;

    return Array.from(document.querySelectorAll("img"))
      .map(img => {
        let src = img.getAttribute('src') || img.getAttribute('data-src');
        if (!src) return null;

        src = src.trim();
        if (src === '') return null;

        if (src.startsWith('http://') || src.startsWith('https://')) {
          return src;
        }

        return `${baseUrl}/${src.replace(/^\//, '')}`;
      })
      .filter(link => link);
  });

  console.log(`📸 Found ${imgSource.length} image(s). Downloading...`);

  let successCount = 0;
  for (let i = 0; i < imgSource.length; i++) {
    const url = imgSource[i];
    const ext = path.extname(url).split('?')[0] || '.jpg';
    const fileName = `image-${i + 1}${ext}`;
    const filePath = path.join(downloadDir, fileName);

    try {
      await downloadImage(url, filePath);
      console.log(`✅ Downloaded: ${fileName}`);
      successCount++;
    } catch (err) {
      console.warn(`❌ Failed to download: ${url}`);
    }
  }

  console.log(`\n🎉 Done! ${successCount}/${imgSource.length} images downloaded to /downloads`);

  await browser.close();
})();
