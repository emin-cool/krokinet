const express = require('express');
const cors = require('cors');
const scraper = require('./scraper');

const app = express();
const PORT = process.env.PORT || 5000;

// İstemci tarafı (React) bu sunucuya erişebilsin diye CORS politikalarını esnetiyoruz.
app.use(cors());
app.use(express.json());

// React uygulamasının verileri çekeceği ana API Endpoint'i
app.get('/api/market-prices', (req, res) => {
  const data = scraper.getLatestData();
  if (data && data.materials) {
    res.json(data);
  } else {
    res.status(503).json({ error: "Veriler henüz kazınıyor (scraping devam ediyor), lütfen birazdan tekrar deneyin." });
  }
});

// Arayüzden "Yenile" butonuna basıldığında kazıyıcıyı zorla çalıştıracak Endpoint
app.post('/api/market-prices/refresh', async (req, res) => {
  await scraper.forceUpdate();
  res.json({ success: true, message: "Veriler başarıyla kazındı.", data: scraper.getLatestData() });
});

app.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`🚀 [Sunucu] Node.js Scraper Backend aktif!`);
  console.log(`🌐 Dinlenilen Port: ${PORT}`);
  console.log(`=========================================`);
});
