const WATCHLIST_STORAGE_KEY = 'watchListCoinIds';
const LEGACY_WATCHLIST_KEY = 'watchListArr';
const PORTFOLIO_STORAGE_KEY = 'portfolioHoldings';
const MARKET_DATA_URL =
    'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=true&price_change_percentage=24h.7d&locale=en';
const MARKET_CACHE_TTL_MS = 3 * 60 * 1000;

const tableBody = document.querySelector('tbody');
const statusMessage = document.getElementById('table-status');
const pageTitle = document.getElementById('crypto-header');
const pageMode = document.body.dataset.marketView || 'market';
const portfolioSummary = document.getElementById('portfolio-summary');
const portfolioTotalElement = document.getElementById('portfolio-total-value');
const portfolioCountElement = document.getElementById('portfolio-holdings-count');
const portfolioLargestElement = document.getElementById(
    'portfolio-largest-position'
);
const isMarketPage = Boolean(tableBody && pageTitle);

function setStatus(message) {
    if (!statusMessage) {
        return;
    }

    statusMessage.textContent = message;
}

function setCachedStatus(timestamp) {
    if (!timestamp) {
        setStatus('Showing cached market data because live data is temporarily unavailable.');
        return;
    }

    const cachedDate = new Date(timestamp);
    setStatus(
        `Showing cached market data from ${cachedDate.toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit',
        })} because live data is temporarily unavailable.`
    );
}

function clearStatus() {
    setStatus('');
}

function loadWatchlistIds() {
    const savedWatchlist = localStorage.getItem(WATCHLIST_STORAGE_KEY);

    if (!savedWatchlist) {
        localStorage.removeItem(LEGACY_WATCHLIST_KEY);
        return [];
    }

    try {
        const parsedWatchlist = JSON.parse(savedWatchlist);

        if (!Array.isArray(parsedWatchlist)) {
            localStorage.removeItem(WATCHLIST_STORAGE_KEY);
            localStorage.removeItem(LEGACY_WATCHLIST_KEY);
            return [];
        }

        const validCoinIds = parsedWatchlist.filter(function (coinId) {
            return typeof coinId === 'string' && coinId.trim() !== '';
        });

        if (validCoinIds.length !== parsedWatchlist.length) {
            localStorage.setItem(
                WATCHLIST_STORAGE_KEY,
                JSON.stringify(validCoinIds)
            );
        }

        localStorage.removeItem(LEGACY_WATCHLIST_KEY);
        return validCoinIds;
    } catch (error) {
        localStorage.removeItem(WATCHLIST_STORAGE_KEY);
        localStorage.removeItem(LEGACY_WATCHLIST_KEY);
        return [];
    }
}

function loadPortfolioHoldings() {
    const savedHoldings = localStorage.getItem(PORTFOLIO_STORAGE_KEY);

    if (!savedHoldings) {
        return {};
    }

    try {
        const parsedHoldings = JSON.parse(savedHoldings);

        if (
            parsedHoldings === null ||
            typeof parsedHoldings !== 'object' ||
            Array.isArray(parsedHoldings)
        ) {
            localStorage.removeItem(PORTFOLIO_STORAGE_KEY);
            return {};
        }

        const sanitizedHoldings = {};

        Object.keys(parsedHoldings).forEach(function (coinId) {
            const amount = Number(parsedHoldings[coinId]);

            if (
                typeof coinId === 'string' &&
                coinId.trim() !== '' &&
                Number.isFinite(amount) &&
                amount > 0
            ) {
                sanitizedHoldings[coinId] = amount;
            }
        });

        localStorage.setItem(
            PORTFOLIO_STORAGE_KEY,
            JSON.stringify(sanitizedHoldings)
        );

        return sanitizedHoldings;
    } catch (error) {
        localStorage.removeItem(PORTFOLIO_STORAGE_KEY);
        return {};
    }
}

let watchlistIds = loadWatchlistIds();
let portfolioHoldings = loadPortfolioHoldings();

function saveWatchlistIds() {
    localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(watchlistIds));
    localStorage.removeItem(LEGACY_WATCHLIST_KEY);
}

function savePortfolioHoldings() {
    localStorage.setItem(
        PORTFOLIO_STORAGE_KEY,
        JSON.stringify(portfolioHoldings)
    );
}

function isSavedCoin(coinId) {
    return watchlistIds.includes(coinId);
}

function getHoldingAmount(coinId) {
    return portfolioHoldings[coinId] || 0;
}

function setHoldingAmount(coinId, amount) {
    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        delete portfolioHoldings[coinId];
    } else {
        portfolioHoldings[coinId] = numericAmount;
    }

    savePortfolioHoldings();
}

function removeHoldingAmount(coinId) {
    delete portfolioHoldings[coinId];
    savePortfolioHoldings();
}

function toggleSavedCoin(coinId) {
    if (isSavedCoin(coinId)) {
        watchlistIds = watchlistIds.filter(function (savedCoinId) {
            return savedCoinId !== coinId;
        });
        removeHoldingAmount(coinId);
    } else {
        watchlistIds = watchlistIds.concat(coinId);
    }

    saveWatchlistIds();
    return isSavedCoin(coinId);
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

function formatAmount(value) {
    if (typeof value !== 'number' || Number.isNaN(value)) {
        return 'N/A';
    }

    return value.toLocaleString('en-US', {
        maximumFractionDigits: 8,
    });
}

function setTrendColor(element, value) {
    if (typeof value !== 'number' || Number.isNaN(value)) {
        element.style.color = '';
        return;
    }

    if (value > 0) {
        element.style.color = 'green';
    } else if (value < 0) {
        element.style.color = 'red';
    } else {
        element.style.color = 'black';
    }
}

function createCell(className, child) {
    const cell = document.createElement('td');
    cell.className = className;
    cell.appendChild(child);
    return cell;
}

function createCoinDetailLink(coin) {
    const detailLink = document.createElement('a');
    detailLink.className = 'coin-detail-link';
    detailLink.href = `./coin.html?id=${encodeURIComponent(coin.id)}`;
    detailLink.setAttribute('aria-label', `View ${coin.name} details`);
    return detailLink;
}

function createTextBlock(className, text) {
    const wrapper = document.createElement('div');
    wrapper.className = className;
    const span = document.createElement('span');
    span.textContent = text;
    wrapper.appendChild(span);
    return {
        wrapper: wrapper,
        textElement: span,
    };
}

function updatePortfolioSummary(coins) {
    if (
        pageMode !== 'portfolio' ||
        !portfolioSummary ||
        !portfolioTotalElement ||
        !portfolioCountElement ||
        !portfolioLargestElement
    ) {
        return;
    }

    const positions = coins.map(function (coin) {
        const amount = getHoldingAmount(coin.id);
        return {
            coin: coin,
            amount: amount,
            value: amount * coin.current_price,
        };
    });

    const totalValue = positions.reduce(function (sum, position) {
        return sum + position.value;
    }, 0);

    portfolioTotalElement.textContent = formatCurrency(totalValue);
    portfolioCountElement.textContent = `${positions.length} holding${
        positions.length === 1 ? '' : 's'
    }`;

    if (positions.length === 0) {
        portfolioLargestElement.textContent = 'No active position yet';
        return;
    }

    const largestPosition = positions.reduce(function (largest, current) {
        return current.value > largest.value ? current : largest;
    });
    const allocation =
        totalValue > 0 ? (largestPosition.value / totalValue) * 100 : 0;

    portfolioLargestElement.textContent = `${largestPosition.coin.name} (${allocation.toFixed(
        2
    )}%)`;
}

function updateEmptyState(visibleCoinsCount) {
    if (pageMode === 'watchlist') {
        setStatus(
            visibleCoinsCount === 0
                ? 'Your watch list is empty. Add coins from the Crypto Currencies page to see them here.'
                : 'Add how much of each saved coin you own, then view the totals on the Portfolio page.'
        );
        return;
    }

    if (pageMode === 'portfolio') {
        setStatus(
            visibleCoinsCount === 0
                ? 'No portfolio holdings yet. Add coins to your watch list and enter amounts to see them here.'
                : ''
        );
        return;
    }

    if (visibleCoinsCount === 0) {
        setStatus('No coins are available right now. Please try again shortly.');
    } else {
        clearStatus();
    }
}

function buildHoldingEditorCell(coin) {
    const controls = document.createElement('div');
    controls.className = 'holding-controls';

    const amountInput = document.createElement('input');
    amountInput.type = 'number';
    amountInput.min = '0';
    amountInput.step = 'any';
    amountInput.className = 'holding-input';
    amountInput.placeholder = '0.00';

    const existingAmount = getHoldingAmount(coin.id);
    if (existingAmount > 0) {
        amountInput.value = existingAmount;
    }

    const saveButton = document.createElement('button');
    saveButton.type = 'button';
    saveButton.className = 'holding-button';
    saveButton.textContent = existingAmount > 0 ? 'Update' : 'Save';

    const hint = document.createElement('span');
    hint.className = 'holding-hint';
    hint.textContent =
        existingAmount > 0
            ? `Saved: ${formatAmount(existingAmount)}`
            : 'Enter amount owned';

    function persistHolding() {
        const enteredAmount = Number(amountInput.value);

        if (!Number.isFinite(enteredAmount) || enteredAmount <= 0) {
            setHoldingAmount(coin.id, 0);
            amountInput.value = '';
            saveButton.textContent = 'Save';
            hint.textContent = 'Holding removed';
            setStatus(`${coin.name} was removed from your portfolio.`);
            return;
        }

        setHoldingAmount(coin.id, enteredAmount);
        saveButton.textContent = 'Update';
        hint.textContent = `Saved: ${formatAmount(enteredAmount)}`;
        setStatus(`${coin.name} holding saved to your portfolio.`);
    }

    saveButton.addEventListener('click', persistHolding);
    amountInput.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
            persistHolding();
        }
    });

    controls.appendChild(amountInput);
    controls.appendChild(saveButton);
    controls.appendChild(hint);

    return createCell('portfolio-entry-td', controls);
}

function buildPortfolioValueCells(coin, totalPortfolioValue) {
    const amount = getHoldingAmount(coin.id);
    const holdingValue = amount * coin.current_price;
    const allocation =
        totalPortfolioValue > 0 ? (holdingValue / totalPortfolioValue) * 100 : 0;

    const amountText = createTextBlock('portfolio-amount-data-div', formatAmount(amount));
    amountText.textElement.className = 'portfolio-amount';

    const valueText = createTextBlock(
        'portfolio-value-data-div',
        formatCurrency(holdingValue)
    );
    valueText.textElement.className = 'portfolio-value';

    const allocationText = createTextBlock(
        'portfolio-allocation-data-div',
        formatPercent(allocation)
    );
    allocationText.textElement.className = 'portfolio-allocation';

    return [
        createCell('portfolio-amount-td', amountText.wrapper),
        createCell('portfolio-value-td', valueText.wrapper),
        createCell('portfolio-allocation-td', allocationText.wrapper),
    ];
}

function renderTableRows(coins) {
    if (!tableBody) {
        return;
    }

    tableBody.innerHTML = '';

    const portfolioTotalValue =
        pageMode === 'portfolio'
            ? coins.reduce(function (sum, coin) {
                  return sum + getHoldingAmount(coin.id) * coin.current_price;
              }, 0)
            : 0;

    coins.forEach(function (coin, index) {
        const row = document.createElement('tr');
        row.dataset.coinId = coin.id;

        const starCell = document.createElement('td');
        starCell.className = 'star';
        const starButton = document.createElement('button');
        starButton.type = 'button';
        starButton.className = isSavedCoin(coin.id) ? 'filled' : 'unfilled';
        starButton.setAttribute(
            'aria-label',
            isSavedCoin(coin.id)
                ? `Remove ${coin.name} from watch list`
                : `Add ${coin.name} to watch list`
        );
        starCell.appendChild(starButton);

        const rankCell = document.createElement('td');
        rankCell.className = 'coin-number';
        rankCell.textContent = coin.market_cap_rank || index + 1;

        const coinCell = document.createElement('td');
        coinCell.className = 'actual-coin';
        const coinInfo = document.createElement('div');
        coinInfo.className = 'coin-info-div';
        const detailLink = createCoinDetailLink(coin);
        const coinLogo = document.createElement('img');
        coinLogo.className = 'coin-logo';
        coinLogo.src = coin.image;
        coinLogo.alt = `${coin.name} logo`;
        const coinName = document.createElement('span');
        coinName.className = 'coin-name';
        coinName.textContent = coin.name;
        const coinSymbol = document.createElement('span');
        coinSymbol.className = 'coin-abrv';
        coinSymbol.textContent = coin.symbol;
        detailLink.appendChild(coinLogo);
        detailLink.appendChild(coinName);
        detailLink.appendChild(coinSymbol);
        coinInfo.appendChild(detailLink);
        coinCell.appendChild(coinInfo);

        const priceText = createTextBlock(
            'coin-price-data-div',
            formatCurrency(coin.current_price)
        );
        const priceCell = createCell('actual-price-td', priceText.wrapper);
        priceText.textElement.className = 'coin-price';

        const changeText = createTextBlock(
            'coin-24hr-percent-data-div',
            formatPercent(coin.price_change_percentage_24h)
        );
        const changeCell = createCell('actual-24hr-%', changeText.wrapper);
        changeText.textElement.className = 'coin-percent-24hr';
        setTrendColor(changeText.textElement, coin.price_change_percentage_24h);

        const highText = createTextBlock(
            'coin-7d-percent-data-div',
            formatCurrency(coin.high_24h)
        );
        const highCell = createCell('acutal-7d-%', highText.wrapper);
        highText.textElement.className = 'coin-percent-7d';

        const athText = createTextBlock(
            'coin-24hr-volume-data-div',
            formatCurrency(coin.ath)
        );
        const athCell = createCell('actual-24hr-volume', athText.wrapper);
        athText.textElement.className = 'coin-24hr-volume';

        const athChangeText = createTextBlock(
            'coin-mkt-cap-data-div',
            formatPercent(coin.ath_change_percentage)
        );
        const athChangeCell = createCell('actual-mkt-cap', athChangeText.wrapper);
        athChangeText.textElement.className = 'coin-mkt-cap';
        setTrendColor(athChangeText.textElement, coin.ath_change_percentage);

        const marketCapText = createTextBlock(
            'sevenDayChart',
            formatCurrency(coin.market_cap, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
            })
        );
        const marketCapCell = createCell('7-day-chart-td', marketCapText.wrapper);
        marketCapText.textElement.className = 'mkt-cap-span';

        row.appendChild(starCell);
        row.appendChild(rankCell);
        row.appendChild(coinCell);
        row.appendChild(priceCell);
        row.appendChild(changeCell);
        row.appendChild(highCell);
        row.appendChild(athCell);
        row.appendChild(athChangeCell);
        row.appendChild(marketCapCell);

        if (pageMode === 'watchlist') {
            row.appendChild(buildHoldingEditorCell(coin));
        }

        if (pageMode === 'portfolio') {
            buildPortfolioValueCells(coin, portfolioTotalValue).forEach(function (
                cell
            ) {
                row.appendChild(cell);
            });
        }

        starButton.addEventListener('click', function () {
            const coinIsSaved = toggleSavedCoin(coin.id);
            starButton.classList.toggle('filled', coinIsSaved);
            starButton.classList.toggle('unfilled', !coinIsSaved);
            starButton.setAttribute(
                'aria-label',
                coinIsSaved
                    ? `Remove ${coin.name} from watch list`
                    : `Add ${coin.name} to watch list`
            );

            if (pageMode === 'watchlist' && !coinIsSaved) {
                row.remove();
                updateEmptyState(tableBody.querySelectorAll('tr').length);
                setStatus(
                    `${coin.name} was removed from your watch list and portfolio.`
                );
            }

            if (pageMode === 'portfolio' && !coinIsSaved) {
                row.remove();
                updatePortfolioSummary(filterCoinsForCurrentPage(coins));
                updateEmptyState(tableBody.querySelectorAll('tr').length);
            }
        });

        tableBody.appendChild(row);
    });

    updatePortfolioSummary(coins);
    updateEmptyState(coins.length);
}

function filterCoinsForCurrentPage(coins) {
    if (pageMode === 'watchlist') {
        return coins.filter(function (coin) {
            return isSavedCoin(coin.id);
        });
    }

    if (pageMode === 'portfolio') {
        return coins.filter(function (coin) {
            return isSavedCoin(coin.id) && getHoldingAmount(coin.id) > 0;
        });
    }

    return coins;
}

function updatePageHeading() {
    if (!pageTitle) {
        return;
    }

    if (pageMode === 'watchlist') {
        pageTitle.textContent = 'Your Watch List';
        return;
    }

    if (pageMode === 'portfolio') {
        pageTitle.textContent = 'Your Portfolio';
        return;
    }

    pageTitle.textContent = 'Crypto Currencies by Market Cap';
}

function showFetchError() {
    if (!tableBody) {
        setStatus(
            'Unable to load the latest market data right now. Please refresh and try again.'
        );
        return;
    }

    tableBody.innerHTML = '';

    if (pageMode === 'portfolio') {
        updatePortfolioSummary([]);
    }

    setStatus(
        'Unable to load the latest market data right now. Please refresh and try again.'
    );
}

updatePageHeading();
if (isMarketPage) {
    setStatus('Loading market data...');

    getCoinGeckoData(
        MARKET_DATA_URL,
        COINGECKO_MARKET_CACHE_KEY,
        MARKET_CACHE_TTL_MS
    )
        .then(function (result) {
            renderTableRows(filterCoinsForCurrentPage(result.data));

            if (result.stale) {
                setCachedStatus(result.cachedAt);
            }
        })
        .catch(function (error) {
            console.error(error);
            showFetchError();
        });
}
