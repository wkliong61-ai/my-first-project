// Fetches daily close prices from Yahoo Finance's public chart endpoint
// and writes them to data/stock-data.json for the chart page to consume.
import fs from 'fs';

const TICKERS = {
  zhipu: '02513.HK',
  minimax: '00100.HK',
};

async function fetchSeries(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=1y&interval=1d`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; stock-chart-fetcher/1.0)' },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${ticker}: HTTP ${res.status}`);
  }
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) {
    throw new Error(`No chart data returned for ${ticker}`);
  }
  const timestamps = result.timestamp ?? [];
  const closes = result.indicators?.quote?.[0]?.close ?? [];

  return timestamps
    .map((t, i) => ({
      date: new Date(t * 1000).toISOString().slice(0, 10),
      close: closes[i] != null ? Math.round(closes[i] * 100) / 100 : null,
    }))
    .filter((point) => point.close != null);
}

async function main() {
  const data = {};
  for (const [key, ticker] of Object.entries(TICKERS)) {
    data[key] = await fetchSeries(ticker);
  }
  data.lastUpdated = new Date().toISOString();

  fs.mkdirSync('data', { recursive: true });
  fs.writeFileSync('data/stock-data.json', JSON.stringify(data, null, 2) + '\n');
  console.log('Wrote data/stock-data.json');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
