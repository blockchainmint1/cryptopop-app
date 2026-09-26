# Merchant & Community Rewards

## The rules (from you)
- 1 reward = $1 off. Rewards never expire.
- Earned only when paying with crypto in POP Wallet, at the merchant's chosen rate (usually 1%).
- Rewards must cover the **whole** bill — no mixing rewards and TSD on one purchase.
- **Store rewards**: only spendable at that store. Free to issue; the store burns them when a customer spends them.
- **Community rewards**: spendable at any approved store in the market. Stores must be approved by the local POP manager.

## How community rewards get started (mutual credit)
Think of it like a local trading circle:
- When the POP manager approves a store, it gets a **starting credit line** (e.g. $250) set by the manager. This is the jumpstart.
- Issuing community rewards to customers uses up the store's credit.
- When a customer spends community rewards at a store, that store's credit goes back up — they can "pay it forward" as new rewards.
- A store that only issues and never accepts hits its limit and stops issuing until it accepts some. Manager can raise/lower limits or pause a store.
- The manager sees every store's balance so the community currency stays trustworthy.

## Who builds what

```text
NectarPay (merchant control panel)      CryptoPOP backend (the bank)        POP Wallet (customer)
- turn on rewards, set rate             - one token per store program        - shows store + community
- choose store / community              - one community token per market       balances
- apply to join community               - credit lines + ledger              - "Pay with rewards" at checkout
- checkout accepts "pay with rewards"   - manager approval screen            - earns rewards after TSD payment
```

### 1. CryptoPOP backend (this project's database + server)
- Tables: reward programs (store, rate, type), community memberships (market, status, credit limit, balance), reward ledger (issue / redeem / burn).
- Each store program = its own token on TEXITcoin/Omni (divisible, cents). Each market has one community token.
- Issue: after a verified NectarPay TSD payment, mint rewards to the customer's wallet (same check we already use for POP).
- Redeem: customer sends rewards to the store's reward address; backend confirms and burns them, and marks the NectarPay invoice paid.
- POP manager screen: approve/decline stores, set credit lines, see balances.

### 2. POP Wallet (this app)
- Rewards section on the home screen: one card per store + community balance per market.
- At a NectarPay checkout: if you hold enough rewards to cover the full bill at that store (or community rewards the store accepts), show **Pay with rewards** next to Pay with TSD.
- After a TSD payment: "+$0.42 rewards at Bobby's BBQ" alongside POP earned.

### 3. NectarPay (paste-in to-do list for that project)
- Merchant settings: rewards on/off, rate %, store-only or also join community (sends an application to the POP manager).
- Invoice response includes the store's reward program and whether it accepts community rewards.
- New "rewards" payment option: accepts a redemption confirmation from CryptoPOP and marks the invoice paid.

## Build order
1. Backend tables + manager approval screen.
2. Earning rewards after TSD payments + wallet balances.
3. Paying with rewards (needs NectarPay's step 3 live).
4. Hand-off document for NectarPay.

## Technical notes
- Tokens are Omni managed properties issued from the per-market/org minter; burn = issuer revoke after the redemption transfer lands at the issuer address.
- Credit ledger is authoritative in the database; on-chain supply is reconciled against it.
- Reward issue reuses `claimNectarReward` verification (signature + paid + txid match); amount = floor(fiat × rate, cents).
- Full-cover check enforced both in wallet and server.
