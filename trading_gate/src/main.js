const config = require("../json/config");

const logger = require("./log/local");

const utility = require("./global/utility");
const validation = require("./global/validation");

const panel = require("./ui/panel");

const exchange_binance_api = require("./exchange/binance/api");

const market_cache = require("./exchange/binance/market");
const arbitrage = require("./arbitrage/triangular/trade");
const CalculationNode = require("./arbitrage/triangular/calc");
const test_speed = require("./test/speed");

let recentCalculations = {};
let initialized = null;

let statusUpdate = {
  cycleTimes: [],
};

// Helps identify application startup
logger.binance.info(logger.LINE);
logger.execution.info(logger.LINE);
logger.performance.info(logger.LINE);

if (!config.binance_option.test)
  console.log(`WARNING! Order execution is enabled!\n`);

validation.configuration(config);

process.on("uncaughtException", handle_error);

utility.color_log(`\n[ latency ... ]`, utility.string_to_random_color("dark"));

test_speed
  .multi_ping(5)
  .then((pings) => {
    const msg = `latency - ${utility.average(pings).toFixed(0)} ms`;
    console.log(msg);
    logger.performance.info(msg);
  })
  .then(market_cache.initialize)
  .then(check_balance)
  .then(check_market)
  .then(() => {
    // Listen for depth updates
    const tickers = market_cache.tickers.watching;
    const validDepth = [5, 10, 20, 50, 100, 500, 1000, 5000].find(
      (d) => d >= config.scanner.depth
    );
    console.log(
      `depths - ${Math.ceil(tickers.length / config.web_socket.ticket_num)}`
    );
    console.log(`tickers - ${tickers.length}`);
    if (config.web_socket.ticket_num === 1) {
      return exchange_binance_api.depthCacheStaggered(
        tickers,
        validDepth,
        config.web_socket.init_delay_ms,
        arbitrage_cycle_callback
      );
    } else {
      return exchange_binance_api.depth_cache_combined(
        tickers,
        validDepth,
        config.web_socket.ticket_num,
        config.web_socket.init_delay_ms,
        arbitrage_cycle_callback
      );
    }
  })
  .then(() => {
    utility.color_log(
      `\n[ depth snapshot ... ]`,
      utility.string_to_random_color("dark")
    );
    return market_cache.wait_all_ticket_update(10000);
  })
  .then(() => {
    const msg = `Initialized`;
    console.log(msg);
    logger.execution.info(msg);
    initialized = Date.now();

    utility.grid_log([
      [`Limit`, `Threshold [Profit] `, `Threshold [Age]`],
      [
        `${config.script.max_trade} execution(s)`,
        `${config.script.threshold.profit_percent.toFixed(2)}%`,
        `${config.script.threshold.delay_ms} ms`,
      ],
    ]);

    if (config.panel.allow)
      setInterval(
        () => panel.display_top_calc(recentCalculations, config.panel.row_num),
        config.panel.refresh_ms
      );
    if (config.message.status_refresh_min > 0)
      setInterval(
        display_status_update,
        config.message.status_refresh_min * 1000 * 60
      );
  })
  .catch(handle_error);

var arbitrage_cycle_callback = (ticker) => {
  if (!is_safe_to_calc_arbitrage()) return;
  const startTime = Date.now();
  const depthSnapshots = exchange_binance_api.get_depth_snapshot(
    market_cache.related.tickers[ticker]
  );

  const results = CalculationNode.analyze(
    market_cache.related.trades[ticker],
    depthSnapshots,
    (e) => logger.performance.warn(e),
    arbitrage.is_safe_to_run,
    arbitrage.run_calculated_position
  );

  if (config.panel.allow) Object.assign(recentCalculations, results);
  statusUpdate.cycleTimes.push(utility.ms_since(startTime));
};

var is_safe_to_calc_arbitrage = () => {
  if (arbitrage.inProgressIds.size > 0) return false;
  if (!initialized) return false;
  return true;
};

var display_status_update = () => {
  const statusUpdateIntervalMS = config.message.status_refresh_min * 1000 * 60;

  const tickersWithoutRecentDepthUpdate =
    market_cache.get_ticket_without_depth_update(statusUpdateIntervalMS);
  if (tickersWithoutRecentDepthUpdate.length > 0) {
    logger.performance.debug(
      `Tickers without recent depth cache update: [${tickersWithoutRecentDepthUpdate.sort()}]`
    );
  }

  const cyclesPerSecond =
    statusUpdate.cycleTimes.length / (statusUpdateIntervalMS / 1000);
  logger.performance.debug(
    `Depth cache updates per second:  ${cyclesPerSecond.toFixed(2)}`
  );

  const clockUsagePerCycle =
    (utility.sum(statusUpdate.cycleTimes) / statusUpdateIntervalMS) * 100;
  if (clockUsagePerCycle > 50) {
    logger.performance.warn(
      `CPU clock usage for calculations:  ${clockUsagePerCycle.toFixed(2)}%`
    );
  } else {
    logger.performance.debug(
      `CPU clock usage for calculations:  ${clockUsagePerCycle.toFixed(2)}%`
    );
  }

  statusUpdate.cycleTimes = [];

  test_speed
    .ping()
    .then((latency) => {
      logger.performance.debug(`API Delay: ${latency} ms`);
    })
    .catch((err) => logger.performance.warn(err.message));
};

function handle_error(err) {
  console.error(err);
  logger.binance.error(err);
  process.exit(1);
}

var check_balance = () => {
  if (!!config.binance_option.test) return;

  utility.color_log(
    `\n[ balance ... ]`,
    utility.string_to_random_color("dark")
  );

  return exchange_binance_api.get_money().then((balances) => {
    Object.keys(config.fund).forEach((BASE) => {
      if (balances[BASE].available < config.fund[BASE].MIN) {
        const msg = `Only detected ${balances[BASE].available} ${BASE}, but ${config.fund[BASE].MIN} ${BASE} is required to satisfy your fund.${BASE}.MIN configuration`;
        logger.execution.error(msg);
        throw new Error(msg);
      }
      if (balances[BASE].available < config.fund[BASE].MAX) {
        const msg = `Only detected ${balances[BASE].available} ${BASE}, but ${config.fund[BASE].MAX} ${BASE} is required to satisfy your fund.${BASE}.MAX configuration`;
        logger.execution.error(msg);
        throw new Error(msg);
      }
    });
    if (balances["BNB"].available <= 0.001) {
      const msg = `Only detected ${balances["BNB"].available} BNB which is not sufficient to pay for trading fees via BNB`;
      logger.execution.error(msg);
      throw new Error(msg);
    }
  });
};

var check_market = () => {
  utility.color_log(
    `\n[ scanner ... ]`,
    utility.string_to_random_color("dark")
  );

  if (market_cache.trades.length === 0) {
    const msg = `No triangular trades were identified`;
    logger.execution.error(msg);
    throw new Error(msg);
  }

  return Promise.resolve();
};
