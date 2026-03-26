const COINGECKO_CACHE_PREFIX = 'coingeckoCache::';
const COINGECKO_MARKET_CACHE_KEY = 'markets::top50::usd';

function getCachedCoinGeckoEntry(cacheKey) {
    try {
        const rawValue = localStorage.getItem(COINGECKO_CACHE_PREFIX + cacheKey);

        if (!rawValue) {
            return null;
        }

        const parsedValue = JSON.parse(rawValue);

        if (
            !parsedValue ||
            typeof parsedValue !== 'object' ||
            typeof parsedValue.timestamp !== 'number'
        ) {
            localStorage.removeItem(COINGECKO_CACHE_PREFIX + cacheKey);
            return null;
        }

        return parsedValue;
    } catch (error) {
        localStorage.removeItem(COINGECKO_CACHE_PREFIX + cacheKey);
        return null;
    }
}

function setCachedCoinGeckoEntry(cacheKey, data) {
    try {
        localStorage.setItem(
            COINGECKO_CACHE_PREFIX + cacheKey,
            JSON.stringify({
                timestamp: Date.now(),
                data: data,
            })
        );
    } catch (error) {
        console.error(error);
    }
}

function getCoinGeckoData(url, cacheKey, ttlMs) {
    const cachedEntry = getCachedCoinGeckoEntry(cacheKey);
    const hasFreshCache =
        cachedEntry && Date.now() - cachedEntry.timestamp < ttlMs;

    if (hasFreshCache) {
        return Promise.resolve({
            data: cachedEntry.data,
            source: 'cache',
            stale: false,
            cachedAt: cachedEntry.timestamp,
        });
    }

    return fetch(url)
        .then(function (response) {
            if (!response.ok) {
                const error = new Error('CoinGecko request failed');
                error.status = response.status;
                throw error;
            }

            return response.json();
        })
        .then(function (data) {
            setCachedCoinGeckoEntry(cacheKey, data);

            return {
                data: data,
                source: 'network',
                stale: false,
                cachedAt: Date.now(),
            };
        })
        .catch(function (error) {
            if (cachedEntry) {
                return {
                    data: cachedEntry.data,
                    source: 'cache',
                    stale: true,
                    cachedAt: cachedEntry.timestamp,
                    error: error,
                };
            }

            throw error;
        });
}
