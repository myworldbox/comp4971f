const config = require("../../../json/config");
const logger = require("../../log/local");
const utility = require("../../global/utility");
const Binance = require("node-binance-api");
const binance = new Binance().options(
  Object.assign(
    {
      log: (...args) => logger.binance.info(args.length > 1 ? args : args[0]),
    },
    config.binance_option
  )
);

const binance_api = {
  sortedDepthCache: {},

  exchangeInfo() {
    return binance.exchangeInfo(null);
  },

  get_money() {
    return binance.balance(null).then((balances) => {
      Object.values(balances).forEach((balance) => {
        balance.available = parseFloat(balance.available);
        balance.onOrder = parseFloat(balance.onOrder);
      });
      return balances;
    });
  },

  /*
  the get_depth_snapshot function retrieves depth snapshots for a list of tickers. It compares the event times of the depth cache in binance_api.sortedDepthCache and the current depth cache obtained from the Binance API. If the event times match, it uses the existing depth cache, and if they don't match, it retrieves a new depth cache. The function then returns an object containing the depth snapshots for each ticker.
  */
  get_depth_snapshot(tickers, maxDepth = config.scanner.depth) {
    const depthSnapshot = {};
    tickers.forEach((ticker) => {
      if (
        binance_api.sortedDepthCache[ticker].eventTime ===
        binance.depthCache(ticker).eventTime
      ) {
        depthSnapshot[ticker] = { ...binance_api.sortedDepthCache[ticker] };
      } else {
        depthSnapshot[ticker] = { ...binance_api.sortedDepthCache[ticker] } = {
          ...binance_api.get_depth_cache_sorted(ticker, maxDepth),
        };
      }
    });
    return depthSnapshot;
  },
  async market_buy(ticker, quantity) {
    logger.execution.info(
      `${
        binance.getOption("test") ? "Test: Buying" : "Buying"
      } ${quantity} ${ticker} @ market price`
    );
    const before = Date.now();
    try {
      const response = await binance.marketBuy(ticker, quantity, {
        type: "MARKET",
      });
      if (binance.getOption("test")) {
        logger.execution.info(
          `Test: Successfully bought ${ticker} @ market price`
        );
      } else {
        logger.execution.info(
          `Successfully bought ${response.executedQty} ${ticker} @ a quote of ${
            response.cummulativeQuoteQty
          } in ${utility.ms_since(before)} ms`
        );
      }
      return response;
    } catch (error) {
      return binance_api.buy_or_sell_error(error);
    }
  },
  async market_sell(ticker, quantity) {
    logger.execution.info(
      `${
        binance.getOption("test") ? "Test: Selling" : "Selling"
      } ${quantity} ${ticker} @ market price`
    );
    try {
      const before = Date.now();
      const response = await binance.marketSell(ticker, quantity, {
        type: "MARKET",
      });
      if (binance.getOption("test")) {
        logger.execution.info(
          `Test: Successfully sold ${ticker} @ market price`
        );
      } else {
        logger.execution.info(
          `Successfully sold ${response.executedQty} ${ticker} @ a quote of ${
            response.cummulativeQuoteQty
          } in ${utility.ms_since(before)} ms`
        );
      }
      return response;
    } catch (error) {
      return binance_api.buy_or_sell_error(error);
    }
  },
  market_buy_or_sell(method) {
    return method === "BUY" ? market_buy : market_sell;
  },

  buy_or_sell_error(error) {
    try {
      return Promise.reject(new Error(JSON.parse(error.body).msg));
    } catch (e) {
      logger.execution.error(error);
      return Promise.reject(new Error(error.body));
    }
  },

  time() {
    return binance.time(null);
  },

  /*
  the depthCacheStaggered function retrieves depth cache data for multiple tickers using Binance API's websockets. It initializes the depth cache for each ticker, sets up a websocket connection, and calls the provided callback function cb whenever a depth cache update is received
  */
  depthCacheStaggered(tickers, limit, stagger, cb) {
    tickers.forEach(
      (ticker) => (binance_api.sortedDepthCache[ticker] = { eventTime: 0 })
    );
    return binance.websockets.depthCacheStaggered(
      tickers,
      binance_api.create_depth_ws_callback(cb),
      limit,
      stagger
    );
  },

  /*
  the depth_cache_combined function retrieves combined depth cache data for multiple tickers by processing them in groups using Binance API's websockets. It initializes the depth cache for each ticker, sets up websocket connections for each group of tickers, and calls the provided callback function cb for depth cache updates. It returns a promise chain representing the processing of ticker groups.
  */
  depth_cache_combined(tickers, limit, groupSize, stagger, cb) {
    tickers.forEach(
      (ticker) => (binance_api.sortedDepthCache[ticker] = { eventTime: 0 })
    );
    let chain = null;
    for (let i = 0; i < tickers.length; i += groupSize) {
      const tickerGroup = tickers.slice(i, i + groupSize);
      const promise = () =>
        new Promise((resolve) => {
          binance.websockets.depthCache(
            tickerGroup,
            binance_api.create_depth_ws_callback(cb),
            limit
          );
          setTimeout(resolve, stagger);
        });
      chain = chain ? chain.then(promise) : promise();
    }
    return chain;
  },

  create_depth_ws_callback(cb) {
    // 'context' exists when processing a websocket update NOT when first populating via snapshot
    return (ticker, depth, context) => context && cb(ticker);
  },

  get_depth_cache_sorted(ticker, max = config.scanner.depth) {
    let depthCache = binance.depthCache(ticker);
    depthCache.bids = binance_api.sort_bid(depthCache.bids, max);
    depthCache.asks = binance_api.sort_ask(depthCache.asks, max);
    return depthCache;
  },

  get_depth_cache_unsorted(ticker) {
    return binance.depthCache(ticker);
  },

  sort_bid(cache, max = Infinity) {
    let depth = {};
    Object.keys(cache)
      .sort((a, b) => parseFloat(b) - parseFloat(a))
      .slice(0, max)
      .forEach((price) => (depth[price] = cache[price]));
    return depth;
  },

  sort_ask(cache, max = Infinity) {
    let depth = {};
    Object.keys(cache)
      .sort((a, b) => parseFloat(a) - parseFloat(b))
      .slice(0, max)
      .forEach((price) => (depth[price] = cache[price]));
    return depth;
  },
};

module.exports = binance_api;
