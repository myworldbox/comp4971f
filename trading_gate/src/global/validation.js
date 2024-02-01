const logger = require("../log/local");
const utility = require("./utility");

const validation = {
  configuration(config) {
    utility.color_log(
      `\n[ configuration ... ]`,
      utility.string_to_random_color("dark")
    );

    // key
    if (config.binance_option.APIKEY === "" && !config.binance_option.test) {
      const msg = `Trade executions will fail without an api key (KEY.API)`;
      logger.execution.warn(msg);
    }
    if (config.binance_option.APISECRET === "" && !config.binance_option.test) {
      const msg = `Trade executions will fail without an api secret (KEY.SECRET)`;
      logger.execution.warn(msg);
    }

    // fund
    Object.keys(config.fund).forEach((BASE) => {
      if (typeof BASE !== "string") {
        const msg = `Investment base (fund.${BASE}) must be a string`;
        logger.execution.error(msg);
        throw new Error(msg);
      }
      if (BASE !== BASE.trim()) {
        const msg = `Investment base (fund.${BASE}) cannot contain whitespace`;
        logger.execution.error(msg);
        throw new Error(msg);
      }
      if (BASE !== BASE.toUpperCase()) {
        const msg = `Investment base (fund.${BASE}) must be uppercase`;
        logger.execution.error(msg);
        throw new Error(msg);
      }
      if (isNaN(config.fund[BASE].MIN) || config.fund[BASE].MIN <= 0) {
        const msg = `Minimum investment quantity (fund.${BASE}.MIN) must be a positive number`;
        logger.execution.error(msg);
        throw new Error(msg);
      }
      if (isNaN(config.fund[BASE].MAX) || config.fund[BASE].MAX <= 0) {
        const msg = `Maximum investment quantity (fund.${BASE}.MAX) must be a positive number`;
        logger.execution.error(msg);
        throw new Error(msg);
      }
      if (isNaN(config.fund[BASE].STEP) || config.fund[BASE].STEP <= 0) {
        const msg = `Investment step size (fund.${BASE}.STEP) must be a positive number`;
        logger.execution.error(msg);
        throw new Error(msg);
      }
      if (config.fund[BASE].MIN > config.fund[BASE].MAX) {
        const msg = `Minimum investment quantity (fund.${BASE}.MIN) cannot be greater than maximum investment quantity (fund.${BASE}.MAX)`;
        logger.execution.error(msg);
        throw new Error(msg);
      }
      if (
        config.fund[BASE].MIN !== config.fund[BASE].MAX &&
        config.fund[BASE].MIN + config.fund[BASE].STEP > config.fund[BASE].MAX
      ) {
        const msg = `Step size (fund.${BASE}.STEP) is too large for calculation optimization`;
        logger.execution.warn(msg);
      }
    });

    // scanner
    if (!Number.isInteger(config.scanner.depth) || config.scanner.depth <= 0) {
      const msg = `Depth size (scanner.depth) must be a positive integer`;
      logger.execution.error(msg);
      throw new Error(msg);
    }
    if (config.scanner.depth > 5000) {
      const msg = `Depth size (scanner.depth) cannot be greater than 5000`;
      logger.execution.error(msg);
      throw new Error(msg);
    }
    if (config.scanner.depth > 100 && config.scanner.whitelist.length === 0) {
      const msg = `Using a depth size (scanner.depth) higher than 100 requires defining a whitelist (scanner.whitelist)`;
      logger.execution.error(msg);
      throw new Error(msg);
    }
    if (!Array.isArray(config.scanner.whitelist)) {
      const msg = `Whitelist (scanner.whitelist) must be an array`;
      logger.execution.error(msg);
      throw new Error(msg);
    }
    if (config.scanner.whitelist.some((sym) => typeof sym !== "string")) {
      const msg = `Whitelist symbols must all be strings`;
      logger.execution.error(msg);
      throw new Error(msg);
    }
    if (config.scanner.whitelist.some((sym) => sym !== sym.toUpperCase())) {
      const msg = `Whitelist symbols must all be uppercase`;
      logger.execution.error(msg);
      throw new Error(msg);
    }

    // script
    if (typeof !config.binance_option.test !== "boolean") {
      const msg = `Execution toggle (script.allow) must be a boolean`;
      logger.execution.error(msg);
      throw new Error(msg);
    }
    if (
      !Number.isInteger(config.script.max_trade) ||
      config.script.max_trade < 0
    ) {
      const msg = `Execution cap (script.max_trade) must be a positive integer`;
      logger.execution.error(msg);
      throw new Error(msg);
    }
    if (!["sequential", "concurrent"].includes(config.script.strategy)) {
      const msg = `Execution strategy (script.strategy) must be one of the following values: linear, parallel]`;
      logger.execution.error(msg);
      throw new Error(msg);
    }
    if (
      config.script.strategy === "concurrent" &&
      config.scanner.whitelist.length === 0
    ) {
      const msg = `Parallel execution requires defining a whitelist (scanner.whitelist)`;
      logger.execution.error(msg);
      throw new Error(msg);
    }
    if (
      !config.script.template.every((template) =>
        ["BUY", "SELL", "*"].includes(template)
      )
    ) {
      const msg = `Execution template (script.template) can only contain the following values: BUY, SELL, *`;
      logger.execution.error(msg);
      throw new Error(msg);
    }
    if (isNaN(config.script.fee) || config.script.fee < 0) {
      const msg = `Execution fee (script.fee) must be a positive number`;
      logger.execution.error(msg);
      throw new Error(msg);
    }
    if (config.script.fee === 0) {
      const msg = `Execution fee (script.fee) of zero is likely incorrect`;
      logger.execution.warn(msg);
    }
    if (isNaN(config.script.threshold.profit_percent)) {
      const msg = `Profit threshold (script.threshold.profit_percent) must be a number`;
      logger.execution.error(msg);
      throw new Error(msg);
    }
    if (
      !Number.isInteger(config.script.threshold.delay_ms) ||
      config.script.threshold.delay_ms <= 0
    ) {
      const msg = `Age threshold (script.threshold.delay_ms) must be a positive number`;
      logger.execution.error(msg);
      throw new Error(msg);
    }

    // panel
    if (typeof config.panel.allow !== "boolean") {
      const msg = `panel toggle (panel.allow) must be a boolean`;
      logger.execution.error(msg);
      throw new Error(msg);
    }
    if (!Number.isInteger(config.panel.row_num) || config.panel.row_num <= 0) {
      const msg = `panel row count (panel.row_num) must be a positive integer`;
      logger.execution.error(msg);
      throw new Error(msg);
    }
    if (
      !Number.isInteger(config.panel.refresh_ms) ||
      config.panel.refresh_ms <= 0
    ) {
      const msg = `panel refresh rate (panel.refresh_ms) must be a positive integer`;
      logger.execution.error(msg);
      throw new Error(msg);
    }

    // LOG
    if (typeof config.message.beautify !== "boolean") {
      const msg = `Logging pretty print toggle (message.beautify) must be a boolean`;
      logger.execution.error(msg);
      throw new Error(msg);
    }
    if (
      isNaN(config.message.status_refresh_min) ||
      config.message.status_refresh_min < 0
    ) {
      const msg = `Status update interval (message.status_refresh_min) must be a positive number`;
      logger.execution.error(msg);
      throw new Error(msg);
    }

    // web_socket
    if (
      !Number.isInteger(config.web_socket.ticket_num) ||
      config.web_socket.ticket_num <= 0
    ) {
      const msg = `Websocket bundle size (web_socket.ticket_num) must be a positive integer`;
      logger.execution.error(msg);
      throw new Error(msg);
    }
    if (config.web_socket.ticket_num > 1024) {
      const msg = `Websocket bundle size (web_socket.ticket_num) cannot be greater than 1024`;
      logger.execution.error(msg);
      throw new Error(msg);
    }
    if (
      !Number.isInteger(config.web_socket.init_delay_ms) ||
      config.web_socket.init_delay_ms < 0
    ) {
      const msg = `Websocket initialization interval (web_socket.init_delay_ms) must be a positive integer`;
      logger.execution.error(msg);
      throw new Error(msg);
    }

    return true;
  },
};

module.exports = validation;
