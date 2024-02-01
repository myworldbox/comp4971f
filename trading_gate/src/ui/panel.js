const blessed = require("blessed");
const config = require("../../json/config.json");
const digest = require("../../json/digest.json");
const request = require("../global/request");
const utility = require("../global/utility");

const panel = {
  screen: null,
  objects: {
    calculationTable: null,
  },
  cache: {},

  init() {
    if (panel.screen) return;
    panel.screen = blessed.screen({
      smartCSR: true,
    });
  },

  create_table(options) {
    return blessed.table({
      border: {
        type: "line",
      },
      style: {
        header: {
          fg: "yellow",
          bold: true,
        },
      },
      ...options,
    });
  },

  async display_top_calc(calculations, rowCount = 10) {
    panel.init();

    if (!panel.objects.calculationTable) {
      panel.objects.calculationTable = panel.create_table({
        top: "0",
        left: "center",
        width: "50%",
        height: "50%",
      });

      panel.screen.append(panel.objects.calculationTable);
    }

    const now = Date.now();

    let tableData = [
      [
        "Delay [A-B]",
        "Delay [B-C]",
        "Delay [C-A]",
        "Delay [Max]",
        "Path",
        "Profit",
      ],
    ];

    Object.values(calculations)
      .filter(
        ({ depth: { ab, bc, ca } }) =>
          ab.eventTime && bc.eventTime && ca.eventTime
      )
      .sort((a, b) => (a.percent > b.percent ? -1 : 1))
      .slice(0, rowCount)
      .forEach(async ({ trade, percent, depth }) => {
        tableData.push([
          `${now - depth.ab.eventTime}`,
          `${now - depth.bc.eventTime}`,
          `${now - depth.ca.eventTime}`,
          `${
            now -
            Math.min(depth.ab.eventTime, depth.bc.eventTime, depth.ca.eventTime)
          }`,
          `${trade.symbol.a}-${trade.symbol.b}-${trade.symbol.c}`,
          `${(percent - config.script.threshold.profit_percent).toFixed(4)}%`,
        ]);
        const current_node = {
          Time: new Date(now),
          "Delay [A-B]": tableData[1][0],
          "Delay [B-C]": tableData[1][1],
          "Delay [C-A]": tableData[1][2],
          "Delay [Max]": tableData[1][3],
          Path: tableData[1][4],
          Profit: tableData[1][5],
        };
        if (
          percent > 0 &&
          current_node.Path != panel.cache.Path &&
          current_node.Profit != panel.cache.Profit &&
          now - depth.ab.eventTime > 0 &&
          now - depth.bc.eventTime > 0 &&
          now - depth.ca.eventTime > 0
        ) {
          digest.service.validation = ["Path", "Profit"];
          digest.data = current_node;
          panel.cache = current_node;
          await request.post(config.url.backend, digest);
        }
      });

    panel.objects.calculationTable.setData(tableData);
    panel.screen.render();
  },
};

module.exports = panel;
