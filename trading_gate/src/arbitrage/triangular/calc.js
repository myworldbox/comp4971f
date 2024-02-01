const config = require("../../../json/config");

const calc = {
  /*
  the analyze() function performs the analysis of trades by iterating over each trade, retrieving the depth snapshots, calculating and optimizing the trade using the calc.optimize() function, and storing the results in an array. It also provides callbacks for error handling, checking if a trade should be executed, and executing the trade.
  */
  analyze(
    trades,
    depthCacheClone,
    errorCallback,
    executionCheckCallback,
    executionCallback
  ) {
    const results = [];

    for (let i = 0; i < trades.length; i++) {
      try {
        const trade = trades[i];
        const depthSnapshot = {
          ab: depthCacheClone[trade.ab.ticker],
          bc: depthCacheClone[trade.bc.ticker],
          ca: depthCacheClone[trade.ca.ticker],
        };

        const calculated = calc.optimize(trade, depthSnapshot);
        if (config.panel.allow) results.push(calculated);
        if (executionCheckCallback(calculated)) {
          executionCallback(calculated);
          break;
        }
      } catch (error) {
        errorCallback(error.message);
      }
    }

    return results;
  },

  /*
  the optimize() function optimizes a trade by iterating over a range of quantities and selecting the calculation with the highest percentage profit. It uses the calc.calculate() function to perform calculations based on the given inputs and returns the best calculation result found during the iteration.
  */
  optimize(trade, depthSnapshot) {
    const { MIN, MAX, STEP } = config.fund[trade.symbol.a];
    let bestCalculation = null;

    for (let quantity = MIN; quantity <= MAX; quantity += STEP) {
      const calculation = calc.calculate(quantity, trade, depthSnapshot);
      if (!bestCalculation || calculation.percent > bestCalculation.percent) {
        bestCalculation = calculation;
      }
    }

    return bestCalculation;
  },

  /*
  the calculate() function performs calculations for a trade based on the investment amount, trade details, and depth snapshot. It determines the quantities and depths for each leg of the trade, as well as the amounts spent, earned, and deltas for each currency involved in the trade.
  */
  calculate(investmentA, trade, depthSnapshot) {
    let calculated = {
      id: `${trade.symbol.a}-${trade.symbol.b}-${trade.symbol.c}`,
      trade: trade,
      depth: depthSnapshot,
      ab: {
        quantity: 0,
        depth: 0,
      },
      bc: {
        quantity: 0,
        depth: 0,
      },
      ca: {
        quantity: 0,
        depth: 0,
      },
      a: {
        spent: 0,
        earned: 0,
        delta: 0,
      },
      b: {
        spent: 0,
        earned: 0,
        delta: 0,
      },
      c: {
        spent: 0,
        earned: 0,
        delta: 0,
      },
    };

    if (trade.ab.method === "BUY") {
      // Buying BA
      const { value: dustedB } = calc.order_book_conversion(
        investmentA,
        trade.symbol.a,
        trade.symbol.b,
        trade.ab.ticker,
        depthSnapshot.ab
      );
      calculated.b.earned = calculated.ab.quantity = calc.calculate_dustless(
        dustedB,
        trade.ab.dustDecimals
      );
      ({ value: calculated.a.spent, depth: calculated.ab.depth } =
        calc.order_book_reverse_conversion(
          calculated.b.earned,
          trade.symbol.b,
          trade.symbol.a,
          trade.ab.ticker,
          depthSnapshot.ab
        ));
    } else {
      // Selling AB
      calculated.a.spent = calculated.ab.quantity = calc.calculate_dustless(
        investmentA,
        trade.ab.dustDecimals
      );
      ({ value: calculated.b.earned, depth: calculated.ab.depth } =
        calc.order_book_conversion(
          calculated.a.spent,
          trade.symbol.a,
          trade.symbol.b,
          trade.ab.ticker,
          depthSnapshot.ab
        ));
    }

    if (trade.bc.method === "BUY") {
      // Buying CB
      const { value: dustedC } = calc.order_book_conversion(
        calculated.b.earned,
        trade.symbol.b,
        trade.symbol.c,
        trade.bc.ticker,
        depthSnapshot.bc
      );
      calculated.c.earned = calculated.bc.quantity = calc.calculate_dustless(
        dustedC,
        trade.bc.dustDecimals
      );
      ({ value: calculated.b.spent, depth: calculated.bc.depth } =
        calc.order_book_reverse_conversion(
          calculated.c.earned,
          trade.symbol.c,
          trade.symbol.b,
          trade.bc.ticker,
          depthSnapshot.bc
        ));
    } else {
      // Selling BC
      calculated.b.spent = calculated.bc.quantity = calc.calculate_dustless(
        calculated.b.earned,
        trade.bc.dustDecimals
      );
      ({ value: calculated.c.earned, depth: calculated.bc.depth } =
        calc.order_book_conversion(
          calculated.b.spent,
          trade.symbol.b,
          trade.symbol.c,
          trade.bc.ticker,
          depthSnapshot.bc
        ));
    }

    if (trade.ca.method === "BUY") {
      // Buying AC
      const { value: dustedA } = calc.order_book_conversion(
        calculated.c.earned,
        trade.symbol.c,
        trade.symbol.a,
        trade.ca.ticker,
        depthSnapshot.ca
      );
      calculated.a.earned = calculated.ca.quantity = calc.calculate_dustless(
        dustedA,
        trade.ca.dustDecimals
      );
      ({ value: calculated.c.spent, depth: calculated.ca.depth } =
        calc.order_book_reverse_conversion(
          calculated.a.earned,
          trade.symbol.a,
          trade.symbol.c,
          trade.ca.ticker,
          depthSnapshot.ca
        ));
    } else {
      // Selling CA
      calculated.c.spent = calculated.ca.quantity = calc.calculate_dustless(
        calculated.c.earned,
        trade.ca.dustDecimals
      );
      ({ value: calculated.a.earned, depth: calculated.ca.depth } =
        calc.order_book_conversion(
          calculated.c.spent,
          trade.symbol.c,
          trade.symbol.a,
          trade.ca.ticker,
          depthSnapshot.ca
        ));
    }

    // Calculate deltas
    calculated.a.delta = calculated.a.earned - calculated.a.spent;
    calculated.b.delta = calculated.b.earned - calculated.b.spent;
    calculated.c.delta = calculated.c.earned - calculated.c.spent;

    calculated.percent =
      (calculated.a.delta / calculated.a.spent) * 100 - config.script.fee * 3;
    if (!calculated.percent) calculated.percent = -100;

    return calculated;
  },

  /*
  the recalculate_trade_leg() function is used to recalculate the dustless quantity of a leg within a trade based on the earned quantity, trade details (including method, base, quote, ticker, and dust decimals), and the depth snapshot. It takes into account whether the trade involves buying or selling the base currency and performs the necessary calculations accordingly.
  */
  recalculate_trade_leg(
    { base, quote, method, ticker, dustDecimals },
    quantityEarned,
    depthSnapshot
  ) {
    if (method === "BUY") {
      const { value: dustedQuantity } = calc.order_book_conversion(
        quantityEarned,
        quote,
        base,
        ticker,
        depthSnapshot
      );
      return calc.calculate_dustless(dustedQuantity, dustDecimals);
    }
    return calc.calculate_dustless(quantityEarned, dustDecimals);
  },
  direct_or_indirect_quote(amountFrom, rate, quantity, isDirect) {
    if (isDirect) {
      if (quantity < amountFrom) {
        amountFrom -= quantity;
        return [amountFrom, quantity * rate];
      } else {
        return [0, amountFrom * rate];
      }
    } else {
      const exchangeableAmount = quantity * rate;
      if (exchangeableAmount < amountFrom) {
        amountFrom -= exchangeableAmount;
        return [amountFrom, quantity];
      } else {
        return [0, amountFrom / rate];
      }
    }
  },

  /*
  The order_book_conversion function essentially performs the conversion by iterating through the order book's rates and quantities, converting the amountFrom until it runs out or the conversion is complete. If the conversion is successful, it returns the converted amount and the depth at which the conversion occurred. If not, it throws an error.
  */
  order_book_conversion(
    amountFrom,
    symbolFrom,
    symbolTo,
    ticker,
    depthSnapshot
  ) {
    if (amountFrom === 0) {
      return { value: 0, depth: 0 };
    }

    let amountTo = 0;
    const isDirect = ticker === symbolFrom + symbolTo;
    const rates = isDirect
      ? Object.keys(depthSnapshot.bids || {})
      : Object.keys(depthSnapshot.asks || {});

    for (let i = 0; i < rates.length; i++) {
      const rate = parseFloat(rates[i]);
      const quantity = isDirect
        ? depthSnapshot.bids[rates[i]]
        : depthSnapshot.asks[rates[i]];
      const [newAmountFrom, convertedAmount] = calc.direct_or_indirect_quote(
        amountFrom,
        rate,
        quantity,
        isDirect
      );
      amountFrom = newAmountFrom;
      amountTo += convertedAmount;
      if (amountFrom === 0) {
        return { value: amountTo, depth: i + 1 };
      }
    }
    const depthLength = rates.length;
    const depthType = isDirect ? "Bid" : "Ask";
    throw new Error(
      `${depthType} depth (${depthLength}) too shallow to convert ${amountFrom} ${symbolFrom} to ${symbolTo} using ${ticker}`
    );
  },

  /*
  The order_book_reverse_conversion function essentially iterates through the order book's rates and quantities, reverse converting the amountFrom until it runs out or the reverse conversion is complete. If the reverse conversion is successful, it returns the reverse-converted amount and the depth at which the reverse conversion occurred. If not, it throws an error.
  */
  order_book_reverse_conversion(
    amountFrom,
    symbolFrom,
    symbolTo,
    ticker,
    depthSnapshot
  ) {
    if (amountFrom === 0) {
      return { value: 0, depth: 0 };
    }

    let amountTo = 0;
    const isDirect = ticker === symbolFrom + symbolTo;
    const rates = isDirect
      ? Object.keys(depthSnapshot.asks || {})
      : Object.keys(depthSnapshot.bids || {});

    for (let i = 0; i < rates.length; i++) {
      const rate = parseFloat(rates[i]);
      const quantity = isDirect
        ? depthSnapshot.asks[rates[i]]
        : depthSnapshot.bids[rates[i]];
      const [newAmountFrom, convertedAmount] = calc.direct_or_indirect_quote(
        amountFrom,
        rate,
        quantity,
        isDirect
      );
      amountFrom = newAmountFrom;
      amountTo += convertedAmount;
      if (amountFrom === 0) {
        return { value: amountTo, depth: i + 1 };
      }
    }
    const depthLength = rates.length;
    const depthType = isDirect ? "Ask" : "Bid";
    throw new Error(
      `${depthType} depth (${depthLength}) too shallow to reverse convert ${amountFrom} ${symbolFrom} to ${symbolTo} using ${ticker}`
    );
  },

  /*
  the get_order_book_depth_requirement() function calculates the depth requirement needed to fulfill a given quantity for a specific trading method using the information from the depth snapshot. It iterates through the bids or asks in the depth snapshot, accumulating the quantity until the desired quantity is reached or exceeds the available depth levels.
  */
  get_order_book_depth_requirement(method, quantity, depthSnapshot) {
    let exchanged = 0;
    let rates;

    if (method === "SELL") {
      rates = Object.keys(depthSnapshot.bids || {});
    } else if (method === "BUY") {
      rates = Object.keys(depthSnapshot.asks || {});
    } else {
      throw new Error(`Unknown method: ${method}`);
    }

    for (let i = 0; i < rates.length; i++) {
      exchanged +=
        method === "SELL"
          ? depthSnapshot.bids[rates[i]]
          : depthSnapshot.asks[rates[i]];
      if (exchanged >= quantity) {
        return i + 1;
      }
    }
    return rates.length;
  },

  /*
  the calculate_dustless() function removes or rounds off decimal places from a given amount. If the amount is an integer, it is returned as is. If it has decimal places, it is rounded to the specified number of decimal places using toFixed() and then converted back to a floating-point number using parseFloat().
  */
  calculate_dustless(amount, dustDecimals) {
    if (Number.isInteger(amount)) return amount;
    const amountString = amount.toFixed(12);
    const decimalIndex = amountString.indexOf(".");
    return parseFloat(amountString.slice(0, decimalIndex + dustDecimals + 1));
  },
};

module.exports = calc;
