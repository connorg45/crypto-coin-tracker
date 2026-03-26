const GLOBAL_MARKET_URL = 'https://api.coingecko.com/api/v3/global';
const TOP_COINS_URL =
    'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum,cardano,dogecoin,chainlink,binancecoin&order=market_cap_desc&per_page=6&page=1&sparkline=false';
const FEAR_AND_GREED_URL = 'https://api.alternative.me/fng/?limit=365';
const homepageResultContainer = document.querySelector('.result');
const emailInput = document.getElementById('email-input');
const emailButton = document.getElementById('email-button');
const successModal = document.getElementById('success-modal');
const currentFearLevelElement = document.querySelector(
    '#current-fear-level .level-value'
);
const monthAgoFearLevelElement = document.querySelector(
    '#month-ago-fear-level .level-value'
);
const yearAgoFearLevelElement = document.querySelector(
    '#year-ago-fear-level .level-value'
);

// Create a div to display the result
let resultDiv = document.createElement('div');
resultDiv.id = 'result';
if (homepageResultContainer) {
    homepageResultContainer.appendChild(resultDiv);
}

function setMarketSummaryFallback() {
    if (!homepageResultContainer) {
        return;
    }

    resultDiv.textContent =
        'Market summary is temporarily unavailable. Please try again shortly.';
}

function setTopCoinsFallback() {
    const priceIds = [
        'btcCardPrice',
        'ethCardPrice',
        'bnbCardPrice',
        'adaCardPrice',
        'dogeCardPrice',
        'linkCardPrice',
    ];
    const changeIds = [
        'btcPriceChangePercentage',
        'ethPriceChangePercentage',
        'bnbPriceChangePercentage',
        'adaPriceChangePercentage',
        'dogePriceChangePercentage',
        'linkPriceChangePercentage',
    ];

    priceIds.forEach(function (id) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = 'Unavailable';
        }
    });

    changeIds.forEach(function (id) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = '--';
            element.style.color = 'black';
        }
    });
}

function setPercentColor(element, value) {
    if (value > 0) {
        element.style.color = 'green';
    } else if (value < 0) {
        element.style.color = 'red';
    } else {
        element.style.color = 'black';
    }
}

function setFearAndGreedFallback() {
    const statusElement = document.getElementById('fear-index-status');
    const valueSelectors = [
        '#current-fear-level .level-value',
        '#month-ago-fear-level .level-value',
        '#year-ago-fear-level .level-value',
    ];

    valueSelectors.forEach(function (selector) {
        const element = document.querySelector(selector);
        if (element) {
            element.textContent = 'Unavailable';
        }
    });

    if (statusElement) {
        statusElement.classList.remove('is-hidden');
    }
}

function formatFearAndGreedValue(entry) {
    return `${entry.value_classification} - ${entry.value}`;
}

function findClosestFearEntry(entries, targetTimestampSeconds) {
    return entries.reduce(function (closestEntry, currentEntry) {
        const currentDistance = Math.abs(
            Number(currentEntry.timestamp) - targetTimestampSeconds
        );
        const closestDistance = Math.abs(
            Number(closestEntry.timestamp) - targetTimestampSeconds
        );

        return currentDistance < closestDistance ? currentEntry : closestEntry;
    });
}

fetch(GLOBAL_MARKET_URL)
    .then(function (response) {
        if (!homepageResultContainer) {
            return null;
        }

        if (!response.ok) {
            throw new Error('Failed to load global market data');
        }

        return response.json();
    })
    .then(function (data) {
        if (!data || !homepageResultContainer) {
            return;
        }

        // Get the 24-hour percentage change for the global market
        let change24h = data.data.market_cap_change_percentage_24h_usd;

        // Determine whether the market is up or down
        let upOrDown;
        if (change24h >= 0) {
            upOrDown = 'up';
        } else {
            upOrDown = 'down';
            change24h = -change24h;
        }

        // Format the percentage change to two decimal place
        change24h = change24h.toFixed(2);

        // Display the result on the page
        let resultText =
            'In the past 24 hours the market is ' +
            upOrDown +
            " <span class='percentage'>" +
            change24h +
            '%</span>';
        resultDiv.innerHTML = resultText;

        // Add CSS styling based on upOrDown
        if (upOrDown === 'up') {
            resultDiv.querySelector('.percentage').style.color = 'green';
        } else {
            resultDiv.querySelector('.percentage').style.color = 'red';
        }
    })
    .catch(function () {
        setMarketSummaryFallback();
    });

// Only show modal if input has '@', and clear input upon successful submission.
if (emailButton && emailInput && successModal) {
    $(document).ready(function () {
        $('#email-button').click(function () {
            var email = $('#email-input').val();
            if (email.includes('@')) {
                $('#success-modal').modal('show');
                $('#email-input').val('');
            }
        });
    });
}

fetch(FEAR_AND_GREED_URL)
    .then(function (response) {
        if (
            !currentFearLevelElement ||
            !monthAgoFearLevelElement ||
            !yearAgoFearLevelElement
        ) {
            return null;
        }

        if (!response.ok) {
            throw new Error('Failed to load fear and greed data');
        }

        return response.json();
    })
    .then(function (data) {
        if (
            !data ||
            !currentFearLevelElement ||
            !monthAgoFearLevelElement ||
            !yearAgoFearLevelElement
        ) {
            return;
        }

        if (!data || !Array.isArray(data.data) || data.data.length === 0) {
            throw new Error('Fear and greed data is missing');
        }

        const history = data.data;
        const currentEntry = history[0];
        const currentTimestamp = Number(currentEntry.timestamp);
        const monthAgoEntry = findClosestFearEntry(
            history,
            currentTimestamp - 30 * 24 * 60 * 60
        );
        const yearAgoEntry = findClosestFearEntry(
            history,
            currentTimestamp - 365 * 24 * 60 * 60
        );

        currentFearLevelElement.textContent = formatFearAndGreedValue(
            currentEntry
        );
        monthAgoFearLevelElement.textContent = formatFearAndGreedValue(
            monthAgoEntry
        );
        yearAgoFearLevelElement.textContent = formatFearAndGreedValue(
            yearAgoEntry
        );
    })
    .catch(function () {
        setFearAndGreedFallback();
    });

const topCoinConfigs = [
    {
        imageId: 'btcImgS3',
        priceChangeId: 'btcPriceChangePercentage',
        priceId: 'btcCardPrice',
    },
    {
        imageId: 'ethImgS3',
        priceChangeId: 'ethPriceChangePercentage',
        priceId: 'ethCardPrice',
    },
    {
        imageId: 'bnbImgS3',
        priceChangeId: 'bnbPriceChangePercentage',
        priceId: 'bnbCardPrice',
    },
    {
        imageId: 'adaImgS3',
        priceChangeId: 'adaPriceChangePercentage',
        priceId: 'adaCardPrice',
    },
    {
        imageId: 'dogeImgS3',
        priceChangeId: 'dogePriceChangePercentage',
        priceId: 'dogeCardPrice',
    },
    {
        imageId: 'linkImgS3',
        priceChangeId: 'linkPriceChangePercentage',
        priceId: 'linkCardPrice',
    },
];

fetch(TOP_COINS_URL)
    .then((response) => response.json())
    .then((data) => {
        if (!Array.isArray(data)) {
            throw new Error('Failed to load top coin data');
        }

        topCoinConfigs.forEach(function (config, index) {
            const coin = data[index];

            if (!coin) {
                return;
            }

            const imageElement = document.getElementById(config.imageId);
            const priceChangeElement = document.getElementById(
                config.priceChangeId
            );
            const priceElement = document.getElementById(config.priceId);

            if (!imageElement || !priceChangeElement || !priceElement) {
                return;
            }

            imageElement.src = coin.image;
            imageElement.alt = `${coin.name} logo`;
            priceChangeElement.textContent = `${coin.price_change_percentage_24h.toFixed(
                2
            )}%`;
            setPercentColor(
                priceChangeElement,
                coin.price_change_percentage_24h
            );
            priceElement.textContent = `$${coin.current_price.toLocaleString()}`;
        });
    })
    .catch(function () {
        setTopCoinsFallback();
    });
