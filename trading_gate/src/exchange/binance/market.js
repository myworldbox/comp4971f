const config = require("../../../json/config.json");
const utility = require("../../global/utility");
const binance_api = require("./api");

const market_cache = {
  tickers: {
    trading: {},
    watching: [],
  },
  trades: [],
  related: {
    trades: {},
    tickers: {},
  },

  /*
  the initialize function retrieves exchange information, filters and processes trading symbols, creates triangular trades, and builds a data structure (market_cache) that stores related tickers and trades. It performs various mappings, filters, and iterations to populate the necessary data structures for further processing and analysis.
  */
  async initialize() {
    utility.color_log(
      `\n[ exchange ... ]`,
      utility.string_to_random_color("dark")
    );
    const exchangeInfo = await binance_api.exchangeInfo();

    // Mapping and Filters
    const isTRADING = (symbolObj) => symbolObj.status === "TRADING";
    const getLOT_SIZE = (symbolObj) => symbolObj.filterType === "LOT_SIZE";

    const tradingSymbolObjects = exchangeInfo.symbols.filter(isTRADING);

    console.log(
      `tickers - ${tradingSymbolObjects.length}/${exchangeInfo.symbols.length}`
    );

    // Extract All Symbols and Tickers
    const uniqueSymbols = new Set();
    tradingSymbolObjects.forEach((symbolObj) => {
      uniqueSymbols.add(symbolObj.baseAsset);
      uniqueSymbols.add(symbolObj.quoteAsset);
      symbolObj.dustDecimals = Math.max(
        symbolObj.filters.filter(getLOT_SIZE)[0].minQty.indexOf("1") - 1,
        0
      );
      market_cache.tickers.trading[symbolObj.symbol] = symbolObj;
    });

    // Get trades from symbols
    Object.keys(config.fund).forEach((symbol1) => {
      uniqueSymbols.forEach((symbol2) => {
        uniqueSymbols.forEach((symbol3) => {
          const trade = market_cache.create_trade(symbol1, symbol2, symbol3);
          if (trade) market_cache.trades.push(trade);
        });
      });
    });

    console.log(`triangular trades - ${market_cache.trades.length}`);

    market_cache.trades.forEach(({ ab, bc, ca }) => {
      if (!market_cache.tickers.watching.includes(ab.ticker))
        market_cache.tickers.watching.push(ab.ticker);
      if (!market_cache.tickers.watching.includes(bc.ticker))
        market_cache.tickers.watching.push(bc.ticker);
      if (!market_cache.tickers.watching.includes(ca.ticker))
        market_cache.tickers.watching.push(ca.ticker);
    });

    market_cache.tickers.watching.forEach((ticker) => {
      market_cache.related.tickers[ticker] = new Set();
      market_cache.related.trades[ticker] = market_cache.trades.filter(
        ({ ab, bc, ca }) => [ab.ticker, bc.ticker, ca.ticker].includes(ticker)
      );
      market_cache.related.trades[ticker].forEach(({ ab, bc, ca }) => {
        market_cache.related.tickers[ticker].add(ab.ticker);
        market_cache.related.tickers[ticker].add(bc.ticker);
        market_cache.related.tickers[ticker].add(ca.ticker);
      });
    });
  },

  /*
  the get_ticket_without_depth_update function filters the tickers in market_cache.tickers.watching based on whether they have received a depth cache update within a specified time period. It returns an array of tickers that haven't received an update or have exceeded the specified time period since the last update.
  */
  get_ticket_without_depth_update(ms = Infinity) {
    return market_cache.tickers.watching.filter((ticker) => {
      const { eventTime } = binance_api.get_depth_cache_unsorted(ticker);
      if (!eventTime) return true;
      if (utility.ms_since(eventTime) > ms) return true;
      return false;
    });
  },

  /*
  the wait_all_ticket_update function waits for all tickers in market_cache.tickers.watching to receive depth cache updates within a specified timeout period. It returns a promise that will be resolved if all tickers receive updates or rejected if the timeout is exceeded. This function is useful when you need to ensure that all tickers have up-to-date depth cache information before proceeding with further operations.
  */
  wait_all_ticket_update(
    timeout = 30000,
    tickers = market_cache.tickers.watching
  ) {
    const start = Date.now();
    const hasUpdate = (ticker) => {
      const { bids, asks } = binance_api.get_depth_cache_unsorted(ticker);
      return Object.keys(bids).length > 0 || Object.keys(asks).length > 0;
    };
    const waitForUpdates = (resolve, reject) => {
      if (tickers.filter(hasUpdate).length === tickers.length) resolve(true);
      else if (utility.ms_since(start) > timeout)
        reject(
          new Error(
            `Timed out waiting for all watched tickers to receive a depth update`
          )
        );
      else setTimeout(waitForUpdates.bind(this, resolve, reject), 1000);
    };
    return new Promise(waitForUpdates);
  },

  /*
  the create_trade function takes three symbols and checks various conditions specified in the script configuration to determine if a trade can be created. It performs symbol whitelisting, checks relationships between symbols, and verifies template matching based on specified methods. If all conditions are met, it returns an object representing the trade. Otherwise, it returns undefined.
  */
  create_trade(a, b, c) {
    a = a.toUpperCase();
    b = b.toUpperCase();
    c = c.toUpperCase();

    if (config.scanner.whitelist.length > 0) {
      if (!config.scanner.whitelist.includes(a)) return;
      if (!config.scanner.whitelist.includes(b)) return;
      if (!config.scanner.whitelist.includes(c)) return;
    }

    const ab = market_cache.get_relationship(a, b);
    if (!ab) return;
    if (
      config.script.template[0] !== "*" &&
      config.script.template[0] !== ab.method
    )
      return;

    const bc = market_cache.get_relationship(b, c);
    if (!bc) return;
    if (
      config.script.template[1] !== "*" &&
      config.script.template[1] !== bc.method
    )
      return;

    const ca = market_cache.get_relationship(c, a);
    if (!ca) return;
    if (
      config.script.template[2] !== "*" &&
      config.script.template[2] !== ca.method
    )
      return;

    return {
      ab,
      bc,
      ca,
      symbol: { a, b, c },
    };
  },

  /*
  the get_relationship function checks if a trading market has tickers for the given symbols a and b. It determines the relationship between the symbols based on the presence of tickers and returns an object with relevant information, such as the method (buy or sell), ticker symbol, base symbol, quote symbol, and dust decimals. If no relationship is found, it returns null.
  */
  get_relationship(a, b) {
    if (market_cache.tickers.trading[a + b])
      return {
        method: "SELL",
        ticker: a + b,
        base: a,
        quote: b,
        dustDecimals: market_cache.tickers.trading[a + b].dustDecimals,
      };
    if (market_cache.tickers.trading[b + a])
      return {
        method: "BUY",
        ticker: b + a,
        base: b,
        quote: a,
        dustDecimals: market_cache.tickers.trading[b + a].dustDecimals,
      };
    return null;
  },
};

module.exports = market_cache;
