const utility = {
  get_floating_pt_from_str: (str) => {
    const regex = /-?\d+(\.\d+)?/g;
    const matches = str.match(regex);
    const numbers = matches ? matches.map(parseFloat) : [];
    return numbers;
  },
  color_log: (message, color) => {
    console.log(`\x1b[38;5;${color}m${message}\x1b[0m`);
  },
  grid_log: (grid) => {
    const getTerminalWidth = () => {
      const { stdout } = require("process");
      return stdout.columns; // Default width is 80 characters
    };
    const terminalWidth = getTerminalWidth();

    // Find the maximum string length in each column
    const columnLengths = grid[0].map((_, columnIndex) =>
      Math.max(...grid.map((row) => String(row[columnIndex]).length))
    );

    const get_formatted_row = (row) => {
      return row.map(
        (cell, columnIndex) =>
          ` ${String(cell).padEnd(columnLengths[columnIndex])} `
      );
    };

    const underline = columnLengths
      .map((length) => "-".repeat(length + 2))
      .join("+");

    grid.forEach((row, rowIndex) => {
      const formattedRow = get_formatted_row(row);
      const rowWidth = formattedRow.join("|").length;
      const paddingWidth = Math.floor((terminalWidth - rowWidth) / 2);
      const padding = " ".repeat(paddingWidth);

      if (rowIndex == 0) {
        utility.color_log(
          padding + formattedRow.join("|"),
          utility.string_to_random_color("light")
        );
      } else {
        console.log(padding + formattedRow.join("|"));
      }
      console.log(padding + underline);

      if (rowIndex === grid.length - 1) {
        console.log(); // Add extra line after the last row
      }
    });
  },
  string_to_random_color: (type) => {
    const getRandomColor = () => {
      return Math.floor(Math.random() * 256);
    };

    const isColorDark = (color) => {
      return color < 128;
    };

    let randomColor = getRandomColor();
    const isDark = type === "dark";

    while (
      (isDark && !isColorDark(randomColor)) ||
      (!isDark && isColorDark(randomColor))
    ) {
      randomColor = getRandomColor();
    }

    return randomColor;
  },
  sum: (array) => {
    return array.reduce((sum, val) => sum + val, 0);
  },

  average: (array) => {
    return utility.sum(array) / array.length;
  },

  prune: (object, threshold) => {
    return Object.keys(object)
      .slice(0, threshold)
      .reduce((prunedObject, key) => {
        prunedObject[key] = object[key];
        return prunedObject;
      }, {});
  },

  prune_snapshot: (snapshot, threshold) => {
    return {
      ...snapshot,
      bids: utility.prune(snapshot.bids, threshold),
      asks: utility.prune(snapshot.asks, threshold),
    };
  },

  second_since(ms) {
    return utility.ms_since(ms) / 1000;
  },

  ms_since(ms) {
    return Date.now() - ms;
  },
};

module.exports = utility;
