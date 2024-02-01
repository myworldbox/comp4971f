const exchange_binance_api = require("../exchange/binance/api");
const utility = require("../global/utility");

const test_speed = {
  /*
  This function measures the network latency by sending a request to the Binance API server and calculating the time it takes to receive a response
  */
  ping() {
    const before = Date.now();
    return exchange_binance_api.time().then(() => utility.ms_since(before));
  },
  /*
  This function performs multiple network latency measurements by invoking the ping function multiple times.
  */
  multi_ping(pingCount = 5) {
    let pings = [];
    let promiseChain = Promise.resolve();

    for (let i = 0; i < pingCount; i++) {
      promiseChain = promiseChain
        .then(test_speed.ping)
        .then((ping) => pings.push(ping));
    }

    return promiseChain.then(() => pings);
  },
};

module.exports = test_speed;
