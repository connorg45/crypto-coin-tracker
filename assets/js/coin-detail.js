const COIN_DETAIL_URL =
    'https://api.coingecko.com/api/v3/coins/';
const COIN_DETAIL_CACHE_TTL_MS = 10 * 60 * 1000;
const COIN_CHART_CACHE_TTL_MS = 15 * 60 * 1000;
const CHART_RANGES = {
    7: {
        days: '7',
        label: '7D',
    },
    30: {
        days: '30',
        label: '30D',
    },
    365: {
        days: '365',
        label: '1Y',
    },
};

const statusMessage = document.getElementById('table-status');
const nameElement = document.getElementById('coin-detail-name');
const symbolElement = document.getElementById('coin-detail-symbol');
const logoElement = document.getElementById('coin-detail-logo');
const priceElement = document.getElementById('coin-detail-price');
const marketCapElement = document.getElementById('coin-detail-market-cap');
const changeElement = document.getElementById('coin-detail-change');
const athElement = document.getElementById('coin-detail-ath');
const descriptionElement = document.getElementById('coin-detail-description');
const chartContainer = document.getElementById('coin-chart');
const chartLowValue = document.getElementById('chart-low-value');
const chartHighValue = document.getElementById('chart-high-value');
const chartButtons = Array.from(
    document.querySelectorAll('.chart-range-button')
);

const params = new URLSearchParams(window.location.search);
const coinId = params.get('id');
let activeRange = '7';
let marketFallbackCoin = null;
let marketFallbackTimestamp = null;

function setStatus(message) {
    if (statusMessage) {
        statusMessage.textContent = message;
    }
}

function setCachedStatus(message, timestamp) {
    if (!timestamp) {
        setStatus(message);
        return;
    }

    const cachedDate = new Date(timestamp);
    setStatus(
        `${message} Cached data from ${cachedDate.toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit',
        })}.`
    );
}

function formatCurrency(value, options) {
    if (typeof value !== 'number' || Number.isNaN(value)) {
        return 'N/A';
    }

    return value.toLocaleString(
        'en-US',
        Object.assign(
            {
                style: 'currency',
                currency: 'USD',
            },
            options || {}
        )
    );
}

function formatPercent(value) {
    if (typeof value !== 'number' || Number.isNaN(value)) {
        return 'N/A';
    }

    return `${value.toFixed(2)}%`;
}

function stripHtml(html) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html || '';
    return wrapper.textContent.trim();
}

function renderCoinDetails(coin) {
    document.title = `${coin.name} | Lizard Coin Tracker`;
    nameElement.textContent = coin.name;
    symbolElement.textContent = coin.symbol;
    logoElement.src = coin.image.large || coin.image.small || '';
    logoElement.alt = `${coin.name} logo`;
    priceElement.textContent = formatCurrency(coin.market_data.current_price.usd);
    marketCapElement.textContent = formatCurrency(
        coin.market_data.market_cap.usd,
        {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }
    );
    changeElement.textContent = formatPercent(
        coin.market_data.price_change_percentage_24h
    );
    changeElement.style.color =
        coin.market_data.price_change_percentage_24h > 0
            ? 'green'
            : coin.market_data.price_change_percentage_24h < 0
            ? 'red'
            : 'black';
    athElement.textContent = formatCurrency(coin.market_data.ath.usd);

    const description = stripHtml(coin.description.en);
    descriptionElement.textContent =
        description || 'Description unavailable for this coin right now.';
}

function renderCoinSummaryFromMarketData(coin) {
    document.title = `${coin.name} | Lizard Coin Tracker`;
    nameElement.textContent = coin.name;
    symbolElement.textContent = coin.symbol;
    logoElement.src = coin.image || '';
    logoElement.alt = `${coin.name} logo`;
    priceElement.textContent = formatCurrency(coin.current_price);
    marketCapElement.textContent = formatCurrency(coin.market_cap, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    });
    changeElement.textContent = formatPercent(coin.price_change_percentage_24h);
    changeElement.style.color =
        coin.price_change_percentage_24h > 0
            ? 'green'
            : coin.price_change_percentage_24h < 0
            ? 'red'
            : 'black';
    athElement.textContent = formatCurrency(coin.ath);
    descriptionElement.textContent =
        'Live profile details are temporarily unavailable, but current market stats are shown from cached market data.';
}

function loadCachedMarketCoin(coinId) {
    const cachedMarkets = getCachedCoinGeckoEntry(COINGECKO_MARKET_CACHE_KEY);

    if (
        !cachedMarkets ||
        !Array.isArray(cachedMarkets.data) ||
        cachedMarkets.data.length === 0
    ) {
        return null;
    }

    const matchedCoin = cachedMarkets.data.find(function (coin) {
        return coin.id === coinId;
    });

    if (!matchedCoin) {
        return null;
    }

    return {
        coin: matchedCoin,
        timestamp: cachedMarkets.timestamp,
    };
}

function buildChartDataFromSparkline(coin) {
    if (
        !coin ||
        !coin.sparkline_in_7d ||
        !Array.isArray(coin.sparkline_in_7d.price) ||
        coin.sparkline_in_7d.price.length === 0
    ) {
        return null;
    }

    return coin.sparkline_in_7d.price.map(function (price, index) {
        return [index, price];
    });
}

function buildSvgChart(prices) {
    const width = 960;
    const height = 320;
    const padding = 28;
    const values = prices.map(function (point) {
        return point[1];
    });
    const minValue = Math.min.apply(null, values);
    const maxValue = Math.max.apply(null, values);
    const valueSpan = maxValue - minValue || 1;

    const points = prices.map(function (point, index) {
        const x =
            padding +
            (index / Math.max(prices.length - 1, 1)) * (width - padding * 2);
        const y =
            height -
            padding -
            ((point[1] - minValue) / valueSpan) * (height - padding * 2);

        return `${x},${y}`;
    });

    const linePath = points.reduce(function (path, point, index) {
        return `${path}${index === 0 ? 'M' : ' L'} ${point}`;
    }, '');
    const areaPath = `${linePath} L ${width - padding},${
        height - padding
    } L ${padding},${height - padding} Z`;

    return `
        <svg class="coin-chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Historical price chart">
            <line class="coin-chart-grid" x1="${padding}" y1="${padding}" x2="${padding}" y2="${
        height - padding
    }"></line>
            <line class="coin-chart-grid" x1="${padding}" y1="${
        height - padding
    }" x2="${width - padding}" y2="${height - padding}"></line>
            <path class="coin-chart-area" d="${areaPath}"></path>
            <path class="coin-chart-path" d="${linePath}"></path>
        </svg>
    `;
}

function renderChart(prices) {
    if (!Array.isArray(prices) || prices.length === 0) {
        throw new Error('Chart data unavailable');
    }

    chartContainer.innerHTML = buildSvgChart(prices);

    const values = prices.map(function (point) {
        return point[1];
    });
    const minValue = Math.min.apply(null, values);
    const maxValue = Math.max.apply(null, values);

    chartLowValue.textContent = `Low: ${formatCurrency(minValue)}`;
    chartHighValue.textContent = `High: ${formatCurrency(maxValue)}`;
}

function setChartLoadingState() {
    chartContainer.textContent = 'Loading chart...';
    chartLowValue.textContent = 'Low: -';
    chartHighValue.textContent = 'High: -';
}

function setChartErrorState() {
    chartContainer.textContent = 'Unable to load chart data right now.';
    chartLowValue.textContent = 'Low: -';
    chartHighValue.textContent = 'High: -';
}

function setActiveRangeButton(range) {
    chartButtons.forEach(function (button) {
        button.classList.toggle('is-active', button.dataset.range === range);
    });
}

function fetchChart(range) {
    if (!coinId) {
        return Promise.resolve();
    }

    const rangeConfig = CHART_RANGES[range];
    setChartLoadingState();

    return getCoinGeckoData(
        `${COIN_DETAIL_URL}${encodeURIComponent(
            coinId
        )}/market_chart?vs_currency=usd&days=${rangeConfig.days}&interval=daily`,
        `chart::${coinId}::${rangeConfig.days}`,
        COIN_CHART_CACHE_TTL_MS
    )
        .then(function (result) {
            renderChart(result.data.prices || []);

            if (result.stale) {
                setCachedStatus(
                    'Showing cached chart data because CoinGecko is temporarily unavailable.',
                    result.cachedAt
                );
            }
        })
        .catch(function () {
            if (range === '7') {
                const sparklinePrices = buildChartDataFromSparkline(
                    marketFallbackCoin
                );

                if (sparklinePrices) {
                    renderChart(sparklinePrices);
                    setCachedStatus(
                        'Showing cached 7D chart data from the market view because CoinGecko is temporarily unavailable.',
                        marketFallbackTimestamp
                    );
                    return;
                }
            }

            setChartErrorState();
        });
}

function loadCoinPage() {
    if (!coinId) {
        setStatus('No coin selected. Return to the market page and choose a coin.');
        nameElement.textContent = 'Coin not found';
        descriptionElement.textContent =
            'Open a coin from the market or watchlist to view its stats and chart.';
        setChartErrorState();
        return;
    }

    setStatus('Loading coin details...');

    const cachedMarketCoin = loadCachedMarketCoin(coinId);
    if (cachedMarketCoin) {
        marketFallbackCoin = cachedMarketCoin.coin;
        marketFallbackTimestamp = cachedMarketCoin.timestamp;
        renderCoinSummaryFromMarketData(cachedMarketCoin.coin);
        setCachedStatus(
            'Showing cached market summary while loading full coin details.',
            cachedMarketCoin.timestamp
        );
    }

    getCoinGeckoData(
        `${COIN_DETAIL_URL}${encodeURIComponent(
            coinId
        )}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`,
        `detail::${coinId}`,
        COIN_DETAIL_CACHE_TTL_MS
    )
        .then(function (result) {
            renderCoinDetails(result.data);

            if (result.stale) {
                setCachedStatus(
                    'Showing cached coin data because CoinGecko is temporarily unavailable.',
                    result.cachedAt
                );
            } else {
                setStatus('');
            }

            return fetchChart(activeRange);
        })
        .catch(function () {
            if (marketFallbackCoin) {
                renderCoinSummaryFromMarketData(marketFallbackCoin);
                setCachedStatus(
                    'Showing cached market summary because full coin details are temporarily unavailable.',
                    marketFallbackTimestamp
                );
                fetchChart(activeRange);
                return;
            }

            setStatus(
                'Unable to load this coin right now. Please return to the market page and try again.'
            );
            nameElement.textContent = 'Coin unavailable';
            descriptionElement.textContent =
                'The requested coin details could not be loaded from CoinGecko.';
            setChartErrorState();
        });
}

chartButtons.forEach(function (button) {
    button.addEventListener('click', function () {
        activeRange = button.dataset.range;
        setActiveRangeButton(activeRange);
        fetchChart(activeRange);
    });
});

setActiveRangeButton(activeRange);
loadCoinPage();
