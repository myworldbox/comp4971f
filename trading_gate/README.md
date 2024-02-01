# trading gate

Author - myworldbox

<a href="https://github.com/myworldbox"><img src="https://myworldbox.github.io/resource/image/portrait/VL_0.jpeg" align="left" height="150" width="150" ></a>

<br/>
<br/>
<br/>
<br/>
<br/>
<br/>
<br/>

This application scans the Binance cryptocurrency exchange platform to identify potential triangle arbitrage opportunities.

1. real time trading for binance

2. intergation with generic backend

3. mutable configuration

4. support of local logging

5. analytics with google sheet through google api

## realtime panel

The panel is updated after every calculation cycle to display snapshots of currently identified arbitrage opportunities. If you want to deactivate the panel, you can set `panel.allow` to false.

- **Time** - order execution time.

- **Delay [A-B]** - delay (ms) in the first arbitrage.

- **Delay [B-C]** - delay (ms) in the second arbitrage.

- **Delay [C-A]** - delay (ms) in the third arbitrage.

- **Delay [MAX]** - maximum delay (ms) in the arbitrage.

- **Path** - three symbols that participate in triangle arbitrage through exchange rates.

- **Profit** - percent profit or loss after minusing the profit threshold in config.

## configuration

All configuration is managed inside the `json/config.json` file.

## assumption

The payment of all fees is done using the BNB balance.

It is important to ensure an adequate amount of BNB is maintained throughout the bot's operation.

## strategies

There are two supported methods of executing an identified triangle arbitrage opportunity.

- **sequential** - three trades are sequentially executed, one after the other.
- **concurrent** - three trades were triggered at once.


## logging

The `/database` directory is where all logs are stored, and the log level can be adjusted using the `message.verbose` configuration property.

- **performance.log** - performance + speed
- **execution.log** - market interactions + profits
- **binance.log** - binance api logging
