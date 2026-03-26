const WATCHLIST_STORAGE_KEY = 'watchListCoinIds';
const LEGACY_WATCHLIST_KEY = 'watchListArr';
const MARKET_DATA_URL =
    'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=false&price_change_percentage=24h.7d&locale=en';

const tableBody = document.querySelector('tbody');
const statusMessage = document.getElementById('table-status');
const pageTitle = document.getElementById('crypto-header');
const pageMode = document.body.dataset.marketView || 'market';

function setStatus(message) {
    if (!statusMessage) {
        return;
    }

    statusMessage.textContent = message;
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

let watchlistIds = loadWatchlistIds();

function saveWatchlistIds() {
    localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(watchlistIds));
    localStorage.removeItem(LEGACY_WATCHLIST_KEY);
}

function isSavedCoin(coinId) {
    return watchlistIds.includes(coinId);
}

function toggleSavedCoin(coinId) {
    if (isSavedCoin(coinId)) {
        watchlistIds = watchlistIds.filter(function (savedCoinId) {
            return savedCoinId !== coinId;
        });
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

function updateEmptyState(visibleCoinsCount) {
    if (pageMode === 'watchlist') {
        setStatus(
            visibleCoinsCount === 0
                ? 'Your watch list is empty. Add coins from the Crypto Currencies page to see them here.'
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

function renderTableRows(coins) {
    tableBody.innerHTML = '';

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
        coinInfo.appendChild(coinLogo);
        coinInfo.appendChild(coinName);
        coinInfo.appendChild(coinSymbol);
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
            }
        });

        tableBody.appendChild(row);
    });

    updateEmptyState(coins.length);
}

function filterCoinsForCurrentPage(coins) {
    if (pageMode !== 'watchlist') {
        return coins;
    }

    return coins.filter(function (coin) {
        return isSavedCoin(coin.id);
    });
}

function updatePageHeading() {
    if (!pageTitle) {
        return;
    }

    if (pageMode === 'watchlist') {
        pageTitle.textContent = 'Your Watch List';
    } else {
        pageTitle.textContent = 'Crypto Currencies by Market Cap';
    }
}

function showFetchError() {
    tableBody.innerHTML = '';
    setStatus(
        'Unable to load the latest market data right now. Please refresh and try again.'
    );
}

updatePageHeading();
setStatus('Loading market data...');

fetch(MARKET_DATA_URL)
    .then(function (response) {
        if (!response.ok) {
            throw new Error('Failed to fetch market data');
        }

        return response.json();
    })
    .then(function (coins) {
        renderTableRows(filterCoinsForCurrentPage(coins));
    })
    .catch(function (error) {
        console.error(error);
        showFetchError();
    });
