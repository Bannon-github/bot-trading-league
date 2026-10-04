# Fee table used by the Bot Trading League (season 1)

Retrieved 2026-10-04. Machine-readable source of truth: `fees.json` (same folder). Pretend money only - this is how the referee simulates each platform.

## Assumptions

- Every bot has ONE CAD cash pool. Each holding records the platform it was bought on and must be sold on that platform.
- No USD sub-accounts: every buy of a USD asset converts CAD->USD and every sale converts USD->CAD at the platform's FX conversion cost (as in a plain CAD account). Norbert's gambit / journaling is not simulated.
- Market orders only (immediate fill). Taker fees apply on maker/taker exchanges. Limit orders are not simulated.
- Base retail tier for every platform (no volume discounts, no paid subscriptions such as Questrade Plus, Kraken+, Coinbase One, Wealthsimple Premium).
- Stock/ETF fills: last trade price from Yahoo Finance +/- the modeled 0.05% spread/slippage (estimate, Yahoo does not give a reliable live bid/ask). Option fills: Yahoo option-chain ask (buy) / bid (sell), quotes may be delayed ~15 min. Crypto fills: the venue's live best ask/bid from its public API where one exists.
- GST/HST on commissions, regulatory pass-through fees (SEC/FINRA/CAT, exchange/ECN, clearing) are not simulated; they are fractions of a cent to a few cents on these order sizes.

- Stock/ETF slippage: 0.05% each way (ESTIMATE). ESTIMATE: modeled half-spread/slippage on stock & ETF fills because the quote source gives last price, not live bid/ask.

## `wealthsimple` - Wealthsimple (self-directed Trade, Core, CAD account)

**Simulated:** $0 commission; FX 1.5%; options 0.0/contract; fractional=True

- fx: 1.5% fee applied to WSII corporate rate: buy rate = rate/(1-0.015), sell rate = rate*(1-0.015) (Wealthsimple's own worked example).

- Source: <https://www.wealthsimple.com/en-ca/pricing> - $0 stock commission; FX fee 1.5% (CAD account); equity options contract fee $0
- Source: <https://www.wealthsimple.com/en-ca/legal/fees/trade> - Fee schedule: commission $0; FX 1.5% formula; equity & ETF options contract fee US$0 (Core); index options extra (not supported here)

## `questrade` - Questrade (self-directed, base plan)

**Simulated:** $0 commission; FX 1.5%; options 0.0/contract; fractional=False

- fx: 1.5% currency conversion fee included in the FX rate.
- option_contract: US equity options $0 + as low as $0/contract (base plan). CAD options $0.99/contract are not supported (no TSX option quotes).

- Source: <https://www.questrade.com/pricing/self-directed-investing/commissions> - $0 commissions on stocks/ETFs; $0 options for most contracts
- Source: <https://www.questrade.com/pricing/self-directed-commissions-plans-fees/transaction> - Currency conversion (USD/CAD) 1.5%; Options Trade - USD $0 + as low as $0/contract; CAD options $0 + 99c/contract

## `ibkr` - Interactive Brokers Canada (IBKR Pro, Fixed pricing)

**Simulated:** per-share (IBKR fixed); FX 0.03%; options 0.65/contract; fractional=us

- fx: Auto currency conversion: IBKR adds/subtracts 0.03% to the exchange rate, no separate commission. (Manual FX order would be 0.2 bp with USD 2 minimum.)
- option_contract: US options USD 0.65/contract (premium >= 0.10; 0.50 if premium 0.05-0.10, 0.25 if < 0.05), min USD 1.00/order.

- Source: <https://www.interactivebrokers.ca/en/pricing/commissions-stocks.php> - US fixed USD 0.005/share, min USD 1.00, max 1% of trade value; Canada fixed CAD 0.01/share, min CAD 1.00, max 0.5%
- Source: <https://www.interactivebrokers.ca/en/pricing/commissions-options.php> - US options USD 0.65/contract (premium >= USD 0.10), min USD 1.00 per order
- Source: <https://www.interactivebrokers.ca/en/pricing/commissions-spot-currencies.php> - Auto currency conversion: +/-0.03% on the rate, no commission

## `qtrade` - Qtrade Direct Investing

**Simulated:** $0 commission; FX 1.75% (est.); options 0.75/contract; fractional=False

- fx: ESTIMATE: Qtrade does not publish its FX spread ('Qtrade may earn revenue on foreign exchange transactions'). 1.75% = midpoint of the 1.5%-2% range reported by independent reviews (brokerguide.ca).
- option_contract: $0 + $0.75 per contract (charged in the option's trading currency).

- Source: <https://www.qtrade.ca/en/investor/pricing.html> - Equities $0, ETFs $0, options $0 + $0.75/contract; FX: 'Qtrade may earn revenue on foreign exchange transactions' (no rate published)
- Source: <https://www.brokerguide.ca/blog/qtrade-fees-2026> - Independent estimate of Qtrade FX markup ~1.5%-2% (used for the estimate)

## `nbdb` - National Bank Direct Brokerage

**Simulated:** $0 commission; FX 1.7%; options 1.25/contract; fractional=False

- fx: Spread 230 bps = 1.70% for USD 0-24,999 (NBDB's own % rounding).
- option_contract: $1.25/contract, min $6.25; max $19.95 when the trade value is under $2,000.

- Source: <https://nbdb.ca/pricing.html> - Online stocks & ETFs free; options $1.25/contract min $6.25 (max $19.95 if value < $2,000); conversion spread 1.70% for USD 0-24,999

## `td` - TD Direct Investing (Standard Trader)

**Simulated:** $9.99/trade; FX 1.4267%; options 1.25/contract; fractional=True

- fx: 1.07% DI spread for $0-9,999 plus a surcharge of one-third of the spread = 1.07% x 4/3 = 1.4267% (TD's own worked example).
- stock_commission: $9.99 per stock/ETF trade; partial (fractional) share trades $1.99. TD's $0 'select ETFs' list is NOT modeled (every ETF pays $9.99) - ESTIMATE/simplification.
- option_contract: $9.99 + $1.25 per contract.

- Source: <https://www.td.com/ca/en/investing/direct-investing/pricing> - Standard Trader: Canadian & US stocks $9.99/trade, partial shares $1.99/trade, options $9.99 + $1.25/contract
- Source: <https://www.td.com/ca/en/investing/direct-investing/pricing/fx-pricing> - FX spread 1.07% for $0-9,999 + surcharge = 1/3 of spread

## `kraken` - Kraken Pro (spot, Tier 1)

**Simulated:** fee 0.8%; fills from: kraken_book

- fee: Taker 0.80% (Tier 1, $0+ 30-day volume); maker 0.40% not used (market orders only).
- fx: When an asset has no CAD pair on Kraken, the USD pair is used and the CAD->USD conversion is charged Kraken's FX-pair fee of 0.20% (FX pairs schedule, $0+ volume).

- Source: <https://www.kraken.com/features/fee-schedule> - Kraken Pro spot Tier 1: maker 0.40%, taker 0.80%; FX pairs (e.g. USD/CAD) 0.20% at $0+ volume
- Source: <https://api.kraken.com/0/public/Ticker> - Live best bid/ask (CAD pairs, e.g. XBTCAD) used for fills

## `coinbase` - Coinbase Advanced (Intro 1)

**Simulated:** fee 1.2%; fills from: coinbase_book

- fee: Taker 1.20% at Intro 1 ($0+ volume); Advanced has no spread (order book).
- fx: ESTIMATE: Coinbase books are USD; the CAD conversion is modeled at the mid USDCAD rate with no extra fee (Coinbase does not publish a CAD conversion markup for Advanced).

- Source: <https://www.coinbase.com/en-ca/advanced-vip> - Fee levels: Intro 1 maker 0.600% / taker 1.200% (>= $0)
- Source: <https://help.coinbase.com/coinbase/trading-and-funding/pricing-and-fees/fees> - No spread on Coinbase Advanced
- Source: <https://api.exchange.coinbase.com/products/BTC-USD/ticker> - Live best bid/ask used for fills

## `ndax` - NDAX

**Simulated:** fee 0.2%; fills from: ndax_book

- fee: Flat 0.20% on every buy and sell, no maker/taker split; trade at the order-book price.

- Source: <https://www.ndax.io/fees> - Flat 0.20% trading fee
- Source: <https://core.ndax.io/v1/ticker> - Live highestBid/lowestAsk (CAD) used for fills

## `newton` - Newton (Silver status)

**Simulated:** fee BTC 1.15%, ETH 1.15%, USDC 1.15%, LTC 1.45%, SOL 1.45%, XLM 1.45%, _other 1.6%; fills from: reference_book

- fee: Newton's fee is applied on the bid/ask; published ranges: Tier 1 (BTC, ETH, USDC) 1.00%-1.15%, Tier 2 (LTC, SOL, XLM) 1.25%-1.45%, Tier 3 (all others) 1.50%-1.60%. The engine uses the TOP of each range (conservative).
- reference: Newton has no public quote API: the Kraken CAD best bid/ask is used as the reference bid/ask (PROXY).

- Source: <https://www.newton.co/fees> - Tier 1 1.00%-1.15%, Tier 2 1.25%-1.45%, Tier 3 1.50%-1.60%
- Source: <https://help.newton.co/hc/en-us/articles/360052371793-What-are-Newton-s-Fees> - Fees apply to buys and sells; Silver status table

## `bitbuy` - Bitbuy Pro Trade

**Simulated:** fee 0.5%; fills from: reference_book

- fee: Pro Trade 0.50% maker and taker (base tier).
- reference: Bitbuy's order book is not available via a public API from the box: the Kraken CAD best bid/ask is used as a PROXY for Bitbuy's book.

- Source: <https://bitbuy.ca/en-ca/fees> - Pro trade 0.50% maker / 0.50% taker (base tier); Express trade uses a spread instead
- Source: <https://support.bitbuy.ca/hc/en-us/articles/26792575494413-Bitbuy-Pro-FAQ> - Bitbuy Pro 0.50% for maker and taker

## `wealthsimple-crypto` - Wealthsimple Crypto (market orders, no Active Trader status)

**Simulated:** fee 0.5%, spread 1.0% (est.); fills from: reference_mid

- fee: Flat 0.5% trading fee + $1 surcharge on orders under $100.
- spread: ESTIMATE: market orders carry a variable spread that Wealthsimple does not publish as a number; 1.00% is the illustrative spread in Wealthsimple's own fee-schedule example.
- reference: Reference price = Kraken CAD mid; Wealthsimple's spread is applied on top (PROXY).

- Source: <https://www.wealthsimple.com/en-ca/legal/fees/crypto> - Flat 0.5% fee + spread on market orders (example uses 1.00%); $1 small-order surcharge under $100 (updated Sep 24 2026)
- Source: <https://www.wealthsimple.com/en-ca/pricing> - Crypto trading fees: flat 0.5% + spread

## Not supported

- **tsx_options**: No public real-time/delayed quote feed for Montreal Exchange options is available to the engine, so Canadian-listed options cannot be simulated.
- **option_writing**: Selling options to open (covered calls, cash-secured puts) is not simulated yet; only buying calls/puts and selling them back (long options).
- **index_options**: Index options (SPX, XSP, NDX, VIX...) are not supported.
- **shorting_margin_leverage**: No shorting, margin, leverage, futures, perps, CFDs or FX trading.
- **leveraged_inverse_etfs**: Leveraged and inverse ETFs/ETNs are rejected by the engine.
- **mutual_funds_gics_bonds**: Mutual funds, GICs, bonds and precious metals are not simulated.
- **staking_lending**: Staking, lending and other yield programs are not simulated.
