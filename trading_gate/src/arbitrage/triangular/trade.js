const config = require("../../../json/config");

const utility = require("../../global/utility");
const logger = require("../../log/local");
const exchange_binance_api = require("../../exchange/binance/api");

const calc = require("./calc");

const trage = {
  inProgressIds: new Set(),
  inProgressSymbols: new Set(),
  attemptedPositions: {},

  /*
  the run_calculated_position function executes a trading position by registering it as an attempted position, executing the trading strategy, logging the results, and updating the sets and objects in the trage module accordingly. It also handles the maximum trade limit and exits the process if the cap is reached.
  */
  run_calculated_position(calculated) {
    const startTime = Date.now();

    const { symbol } = calculated.trade;
    const age = {
      ab: startTime - calculated.depth.ab.eventTime,
      bc: startTime - calculated.depth.bc.eventTime,
      ca: startTime - calculated.depth.ca.eventTime,
    };

    // Register position as being attempted
    trage.attemptedPositions[startTime] = calculated.id;
    trage.inProgressIds.add(calculated.id);
    trage.inProgressSymbols.add(symbol.a);
    trage.inProgressSymbols.add(symbol.b);
    trage.inProgressSymbols.add(symbol.c);

    logger.execution.info(
      `Attempting to execute ${calculated.id} with an age of ${Math.max(
        age.ab,
        age.bc,
        age.ca
      ).toFixed(0)} ms and expected profit of ${calculated.percent.toFixed(4)}%`
    );

    return trage
      .get_run_strategy()(calculated)
      .then((actual) => {
        logger.execution.info(
          `${!config.binance_option.test ? "Executed" : "Test: Executed"} ${
            calculated.id
          } position in ${utility.ms_since(startTime)} ms`
        );

        // Results are only collected when a trade is executed
        if (!!config.binance_option.test) return;

        const price = {
          ab: {
            expected:
              calculated.trade.ab.method === "BUY"
                ? calculated.a.spent / calculated.b.earned
                : calculated.b.earned / calculated.a.spent,
            actual:
              calculated.trade.ab.method === "BUY"
                ? actual.a.spent / actual.b.earned
                : actual.b.earned / actual.a.spent,
          },
          bc: {
            expected:
              calculated.trade.bc.method === "BUY"
                ? calculated.b.spent / calculated.c.earned
                : calculated.c.earned / calculated.b.spent,
            actual:
              calculated.trade.bc.method === "BUY"
                ? actual.b.spent / actual.c.earned
                : actual.c.earned / actual.b.spent,
          },
          ca: {
            expected:
              calculated.trade.ca.method === "BUY"
                ? calculated.c.spent / calculated.a.earned
                : calculated.a.earned / calculated.c.spent,
            actual:
              calculated.trade.ca.method === "BUY"
                ? actual.c.spent / actual.a.earned
                : actual.a.earned / actual.c.spent,
          },
        };

        logger.execution.debug(`${calculated.trade.ab.ticker} Stats:`);
        logger.execution.debug(
          `Expected Conversion:  ${calculated.a.spent.toFixed(8)} ${
            symbol.a
          } into ${calculated.b.earned.toFixed(8)} ${
            symbol.b
          } @ ${price.ab.expected.toFixed(8)}`
        );
        logger.execution.debug(
          `Observed Conversion:  ${actual.a.spent.toFixed(8)} ${
            symbol.a
          } into ${actual.b.earned.toFixed(8)} ${
            symbol.b
          } @ ${price.ab.actual.toFixed(8)}`
        );
        logger.execution.debug(
          `Price Change:         ${(
            ((price.ab.actual - price.ab.expected) / price.ab.expected) *
            100
          ).toFixed(8)}%`
        );
        logger.execution.debug();
        logger.execution.debug(`${calculated.trade.bc.ticker} Stats:`);
        logger.execution.debug(
          `Expected Conversion:  ${calculated.b.spent.toFixed(8)} ${
            symbol.b
          } into ${calculated.c.earned.toFixed(8)} ${
            symbol.c
          } @ ${price.bc.expected.toFixed(8)}`
        );
        logger.execution.debug(
          `Observed Conversion:  ${actual.b.spent.toFixed(8)} ${
            symbol.b
          } into ${actual.c.earned.toFixed(8)} ${
            symbol.c
          } @ ${price.bc.actual.toFixed(8)}`
        );
        logger.execution.debug(
          `Price Change:         ${(
            ((price.bc.actual - price.bc.expected) / price.bc.expected) *
            100
          ).toFixed(8)}%`
        );
        logger.execution.debug();
        logger.execution.debug(`${calculated.trade.ca.ticker} Stats:`);
        logger.execution.debug(
          `Expected Conversion:  ${calculated.c.spent.toFixed(8)} ${
            symbol.c
          } into ${calculated.a.earned.toFixed(8)} ${
            symbol.a
          } @ ${price.ca.expected.toFixed(8)}`
        );
        logger.execution.debug(
          `Observed Conversion:  ${actual.c.spent.toFixed(8)} ${
            symbol.c
          } into ${actual.a.earned.toFixed(8)} ${
            symbol.a
          } @ ${price.ca.actual.toFixed(8)}`
        );
        logger.execution.debug(
          `Price Change:         ${(
            ((price.ca.actual - price.ca.expected) / price.ca.expected) *
            100
          ).toFixed(8)}%`
        );

        const prunedDepthSnapshot = {
          ab: utility.prune_snapshot(
            calculated.depth.ab,
            calculated.ab.depth + 2
          ),
          bc: utility.prune_snapshot(
            calculated.depth.bc,
            calculated.bc.depth + 2
          ),
          ca: utility.prune_snapshot(
            calculated.depth.ca,
            calculated.ca.depth + 2
          ),
        };

        logger.execution.trace(`Pruned depth cache used for calculation:`);
        logger.execution.trace(prunedDepthSnapshot);

        const percent = {
          a: (actual.a.delta / actual.a.spent) * 100,
          b: (actual.b.delta / actual.b.spent) * 100,
          c: (actual.c.delta / actual.c.spent) * 100,
        };

        logger.execution.info();
        logger.execution.info(
          `${symbol.a} delta:\t  ${
            actual.a.delta < 0 ? "" : " "
          }${actual.a.delta.toFixed(8)} (${
            percent.a < 0 ? "" : " "
          }${percent.a.toFixed(4)}%)`
        );
        logger.execution.info(
          `${symbol.b} delta:\t  ${
            actual.b.delta < 0 ? "" : " "
          }${actual.b.delta.toFixed(8)} (${
            percent.b < 0 ? "" : " "
          }${percent.b.toFixed(4)}%)`
        );
        logger.execution.info(
          `${symbol.c} delta:\t  ${
            actual.c.delta < 0 ? "" : " "
          }${actual.c.delta.toFixed(8)} (${
            percent.c < 0 ? "" : " "
          }${percent.c.toFixed(4)}%)`
        );
        logger.execution.info(`BNB fees: \t  ${(-1 * actual.fees).toFixed(8)}`);
        logger.execution.info();
      })
      .catch((err) => logger.execution.error(err.message))
      .then(() => {
        trage.inProgressIds.delete(calculated.id);
        trage.inProgressSymbols.delete(symbol.a);
        trage.inProgressSymbols.delete(symbol.b);
        trage.inProgressSymbols.delete(symbol.c);

        if (
          config.script.max_trade &&
          trage.inProgressIds.size === 0 &&
          trage.get_attempted_position_count() >= config.script.max_trade
        ) {
          logger.execution.info(
            `Cannot exceed user defined execution cap of ${config.script.max_trade} executions`
          );
          process.exit(0);
        }
      });
  },

  /*
  the is_safe_to_run function evaluates various conditions and thresholds to determine if it is safe to execute a trading strategy. It checks the profit threshold, age threshold, symbol in progress, previous attempted positions, position attempt rate, and maximum trade limit. The function returns true if it is safe to run the strategy and false otherwise.
  */
  is_safe_to_run(calculated) {
    // Profit Threshold is Not Satisfied
    if (calculated.percent < config.script.threshold.profit_percent)
      return false;

    // Age Threshold is Not Satisfied
    const ageInMilliseconds =
      Date.now() -
      Math.min(
        calculated.depth.ab.eventTime,
        calculated.depth.bc.eventTime,
        calculated.depth.ca.eventTime
      );
    if (
      isNaN(ageInMilliseconds) ||
      ageInMilliseconds > config.script.threshold.delay_ms
    )
      return false;

    const { symbols } = calculated.trade;

    for (const symbol of symbols) {
      if (trage.inProgressSymbols.has(symbol)) {
        logger.execution.trace(
          `Blocking execution because ${symbol} is currently involved in an execution`
        );
        return false;
      }
    }

    if (
      Object.entries(trage.attemptedPositions).find(
        ([executionTime, id]) =>
          id === calculated.id &&
          executionTime > utility.ms_since(config.script.threshold.delay_ms)
      )
    ) {
      logger.execution.trace(
        `Blocking execution to avoid double executing the same position`
      );
      return false;
    }
    if (trage.get_attempted_position_count_in_last_second() > 1) {
      logger.execution.trace(
        `Blocking execution because ${trage.get_attempted_position_count_in_last_second()} positions have already been attempted in the last second`
      );
      return false;
    }
    if (
      config.script.max_trade &&
      trage.get_attempted_position_count() >= config.script.max_trade
    ) {
      logger.execution.trace(
        `Blocking execution because ${trage.get_attempted_position_count()} executions have been attempted`
      );
      return false;
    }

    return true;
  },

  get_attempted_position_count() {
    return Object.keys(trage.attemptedPositions).length;
  },

  /*
  the get_attempted_position_count_in_last_second function retrieves the number of attempted positions recorded in the trage.attemptedPositions object that occurred within the last second.
  */
  get_attempted_position_count_in_last_second() {
    const timeFloor = Date.now() - 1000;
    return Object.keys(trage.attemptedPositions).filter(
      (time) => time > timeFloor
    ).length;
  },

  get_run_strategy() {
    switch (config.script.strategy) {
      case "concurrent":
        return trage.concurrent_strategy;
      default:
        return trage.sequential_strategy;
    }
  },

  /*
  the concurrent_strategy function executes a concurrent trading strategy based on a calculated trade. It concurrently executes market buy or sell orders for each trade leg, updates the actual object with spent and earned amounts, calculates and updates the fees, and calculates the delta for each symbol. The function returns the final actual object with spent, earned, and delta amounts for each symbol.
  */
  async concurrent_strategy(calculated) {
    const [resultsAB, resultsBC, resultsCA] = await Promise.all([
      exchange_binance_api.market_buy_or_sell(calculated.trade.ab.method)(
        calculated.trade.ab.ticker,
        calculated.ab.quantity
      ),
      exchange_binance_api.market_buy_or_sell(calculated.trade.bc.method)(
        calculated.trade.bc.ticker,
        calculated.bc.quantity
      ),
      exchange_binance_api.market_buy_or_sell(calculated.trade.ca.method)(
        calculated.trade.ca.ticker,
        calculated.ca.quantity
      ),
    ]);

    const parseResult = (method, results) => {
      const [spent, earned, fees] = trage.parse_result(method, results);
      return { spent, earned, fees };
    };

    const actual = {
      a: parseResult(calculated.trade.ab.method, resultsAB),
      b: parseResult(calculated.trade.bc.method, resultsBC),
      c: parseResult(calculated.trade.ca.method, resultsCA),
      fees: 0,
    };

    actual.fees = Object.values(actual).reduce(
      (sum, { fees }) => sum + fees,
      0
    );

    actual.a.delta = actual.a.earned - actual.a.spent;
    actual.b.delta = actual.b.earned - actual.b.spent;
    actual.c.delta = actual.c.earned - actual.c.spent;

    return actual;
  },

  /*
  the sequential_strategy function executes a sequential trading strategy based on a calculated trade. It iteratively executes market orders for each trade leg, updates the actual object with spent and earned amounts, calculates and updates the fees, and recalculates subsequent trade legs based on the actual results. The function returns the final actual object with spent, earned, and delta amounts for each symbol.
  */
  async sequential_strategy(calculated) {
    let actual = {
      a: { spent: 0, earned: 0 },
      b: { spent: 0, earned: 0 },
      c: { spent: 0, earned: 0 },
      fees: 0,
    };
    let recalculated = {
      bc: calculated.bc.quantity,
      ca: calculated.ca.quantity,
    };

    const processTrade = async (method, ticker, quantity) => {
      const results = await exchange_binance_api.market_buy_or_sell(method)(
        ticker,
        quantity
      );
      if (results.orderId) {
        const [spent, earned, fees] = trage.parse_result(method, results);
        actual.fees += fees;
        return { spent, earned };
      }
      return { spent: 0, earned: 0 };
    };

    const { spent: spentAB, earned: earnedAB } = await processTrade(
      calculated.trade.ab.method,
      calculated.trade.ab.ticker,
      calculated.ab.quantity
    );
    actual.a.spent = spentAB;
    actual.b.earned = earnedAB;
    recalculated.ca = calc.recalculate_trade_leg(
      calculated.trade.bc,
      earnedAB,
      exchange_binance_api.get_depth_cache_sorted(calculated.trade.ab.ticker)
    );

    const { spent: spentBC, earned: earnedBC } = await processTrade(
      calculated.trade.bc.method,
      calculated.trade.bc.ticker,
      recalculated.ca
    );
    actual.b.spent = spentBC;
    actual.c.earned = earnedBC;
    recalculated.bc = calc.recalculate_trade_leg(
      calculated.trade.ca,
      earnedBC,
      exchange_binance_api.get_depth_cache_sorted(calculated.trade.bc.ticker)
    );

    const { spent: spentCA, earned: earnedCA } = await processTrade(
      calculated.trade.ca.method,
      calculated.trade.ca.ticker,
      recalculated.bc
    );
    actual.c.spent = spentCA;
    actual.a.earned = earnedCA;

    actual.a.delta = actual.a.earned - actual.a.spent;
    actual.b.delta = actual.b.earned - actual.b.spent;
    actual.c.delta = actual.c.earned - actual.c.spent;

    return actual;
  },

  /*
  the parse_result function takes the trade execution result and the trade method as input. It parses the result to extract the amount spent, amount earned, and fees incurred in the trade. It returns an array with these values. This function is useful for analyzing the outcome of a trade execution and calculating the financial implications of the trade.
  */
  parse_result(method, { executedQty, cummulativeQuoteQty, fills }) {
    const spent =
      method === "BUY"
        ? parseFloat(cummulativeQuoteQty)
        : parseFloat(executedQty);
    const earned =
      method === "SELL"
        ? parseFloat(cummulativeQuoteQty)
        : parseFloat(executedQty);
    const fees = fills
      .filter((fill) => fill.commissionAsset === "BNB")
      .reduce((total, fill) => total + parseFloat(fill.commission), 0);
    return [spent, earned, fees];
  },
};

module.exports = trage;
