// Fetches daily close prices from Yahoo Finance's public chart endpoint
// and writes them to data/stock-data.json for the chart page to consume.
import fs from 'fs';

const TICKERS = {
  zhipu: '02513.HK',
  minimax: '00100.HK',
};

// HKEX displays codes zero-padded to 5 digits, but Yahoo Finance tickers use
// a 4-digit padding (e.g. HKEX "02513" / "00100" -> Yahoo "2513.HK" / "0100.HK").
// Try a few plausible variants since we can't be 100% sure which one Yahoo indexes.
function candidateSymbols(ticker) {
  const match = ticker.match(/^0*(\d+)\.HK$/i);
  if (!match) return [ticker];
  const num = match[1];
  const padded4 = num.padStart(4, '0');
  return [...new Set([ticker, `${padded4}.HK`, `${num}.HK`])];
}

async function fetchChart(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1y&interval=1d`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; stock-chart-fetcher/1.0)' },
  });
  if (!res.ok) {
    return null;
  }
  const json = await res.json();
  return json?.chart?.result?.[0] ?? null;
}

async function fetchSeries(ticker) {
  const errors = [];
  for (const symbol of candidateSymbols(ticker)) {
    const result = await fetchChart(symbol);
    const timestamps = result?.timestamp ?? [];
    const closes = result?.indicators?.quote?.[0]?.close ?? [];
    const points = timestamps
      .map((t, i) => ({
        date: new Date(t * 1000).toISOString().slice(0, 10),
        close: closes[i] != null ? Math.round(closes[i] * 100) / 100 : null,
      }))
      .filter((point) => point.close != null);

    if (points.length > 0) {
      console.log(`Resolved ${ticker} -> ${symbol} (${points.length} points)`);
      return points;
    }
    errors.push(symbol);
  }
  throw new Error(`Failed to fetch ${ticker}: tried ${errors.join(', ')}, none returned data`);
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
