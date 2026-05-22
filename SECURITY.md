# Wallet Risk Control — Security Skill

## When to Use This Skill

Read and apply this skill whenever you are helping a user build a non-custodial crypto wallet
or wallet-related application and the conversation touches any of the following:

- Mnemonic phrase or private key handling (generation, display, import, export)
- Transaction signing flows (`eth_sign`, `personal_sign`, `signTypedData`)
- Token approval or authorization flows (ERC-20 `approve`, `Permit`, `Permit2`)
- DApp interaction (WalletConnect, injected provider, DApp browser)
- Transaction history or address display
- Risk-related UI components (warning banner, confirmation modal, risk badge)
- User safety questions ("how do I protect users from X", "should I warn the user about Y")

Do not apply this skill for general blockchain education unrelated to wallet UX or security
implementation.

---

## 1. Core Threat Reference

The following attack categories are directly relevant to EVM web wallets built during this
activity. Use these definitions to reason about whether a wallet feature introduces risk and
what mitigations to suggest.

### 1.1 Malicious Contract Interaction & Blind Signing

**Definition:** Attackers induce users to sign cryptographically valid transactions or messages
whose business logic (approve, Permit, Permit2) results in asset theft. Users cannot read raw
calldata, creating an information asymmetry the attacker exploits.

**Key risks for builders:**
- ERC-20 `approve` with unlimited allowance (`uint256 max`) presented without clear warning
- Permit / Permit2 off-chain signatures that look identical to harmless "login" prompts
- Transaction calldata displayed as raw hex with no human-readable decode

**Builder checklist:**
- Always decode and display before the sign button is active: function name, contract address
  (with verification status), token, and exact approval amount
- Flag unlimited allowance with a Danger-level warning (see Section 2.2)
- Visually distinguish Permit / Permit2 signatures from login signatures in the UI
- Provide a user-editable amount field so users can reduce approvals to the exact amount needed
- Use Token Core CLI `analyze` to decode calldata before presenting to the user (see Section 4)

---

### 1.2 On-Chain Visual Fraud: Address-Tail Collision

**Definition:** Attackers script-generate addresses matching the first and last N characters of
the user's frequent recipients, then send zero-value or dust transfers to plant the spoofed
address in the user's transaction history. Users who copy addresses from history are tricked
into sending funds to the attacker.

**Key risks for builders:**
- Zero-value token transfers appearing in the default transaction history view
- Truncated address display that makes collision undetectable at a glance

**Builder checklist:**
- Filter zero-value and dust-amount transfers (e.g., ≤ 0.001 USDT) from the default history view
- Show the full address on all confirmation screens — never truncate in a confirm context
- Provide one-click copy with a "Please verify the full address" confirmation nudge
- Guide users to save trusted addresses in an address book; prefer address book over history
  for sending

---

### 1.3 On-Chain Data Pollution: Transaction Memo Phishing

**Definition:** Attackers embed phishing instructions in on-chain memo / data fields,
directing users to contact fake support channels. Users sometimes mistake memo content for
official wallet notifications.

**Key risks for builders:**
- Wallets that faithfully render all memo content become a phishing delivery channel
- Users may not distinguish between chain-originated data and wallet-originated notifications

**Builder checklist:**
- Treat memo / input data fields as untrusted user content; apply XSS sanitization
- Collapse or mask memo content containing contact information, URLs, or social handles;
  require user action to expand, with a risk label
- Display a clear attribution note next to memo content: "This message was sent by the
  transaction sender, not by this wallet"
- Keep official wallet notifications in a separate, isolated channel within the app

---

### 1.4 Fake Token Airdrop Scams

**Definition:** Attackers airdrop counterfeit high-value tokens to user wallets to lure them
into interacting with malicious DApps ("swap" or "claim"), which are actually approval
transactions that drain real assets.

**Key risks for builders:**
- Unverified token contracts displayed alongside legitimate assets without distinction
- "Swap" or "Send" CTAs visible on unknown token entries in the wallet

**Builder checklist:**
- Mark tokens not in a trusted registry (CoinGecko, official token lists) with an "Unverified"
  badge
- Hide Swap / Send shortcuts on unverified tokens by default; require user to opt in
- Show a full-screen risk warning before any interaction with an unverified token contract
- Integrate a known-malicious contract blacklist and hard-block interactions with listed addresses

---

## 2. Security UX Principles

Apply these principles whenever generating wallet UI code or design.

### 2.1 Explicit Over Implicit

Every signing action must show users exactly what they are authorizing before the confirm
button is active:

- Contract address (with verification status badge)
- Human-readable function name (not a raw hex selector)
- Assets affected and exact amounts
- Network being used

### 2.2 Risk Severity System

Use a consistent four-level severity system across all risk UI components:

| Level | When to use | Required treatment |
|-------|-------------|-------------------|
| **Info** | Neutral context (network fee, estimated time) | Inline text, muted style |
| **Warning** | Elevated risk (unverified contract, large amount, first interaction) | Yellow banner, dismissible |
| **Danger** | High risk (unlimited approval, simulation failure, known-bad address) | Red modal, explicit confirmation required |
| **Block** | Policy violation or confirmed malicious address | Hard block, no user bypass |

### 2.3 Irreversibility Signals

Clearly communicate that the following actions cannot be undone:

- Broadcast transactions (permanent on-chain)
- Approval grants (persist until explicitly revoked on-chain)
- Any write operation to a smart contract

### 2.4 Safe Defaults

- Default approval amount: exact amount needed, not unlimited
- Default network: testnet during development and demo
- Default address display: full address on confirmation screens

---

## 3. Rendering Risk UI Components

When generating frontend code that includes security warnings, confirmation modals, risk banners,
or any risk-related UI component, you **must** follow the design system conventions defined in
the `token-ui` repository.

> **[Refer to `token-ui` AGENTS.md and CLAUDE.md for design tokens, component names, color
> semantics, and spacing conventions before generating any risk UI code. Do not invent component
> names or color values — use only what is defined there.]**

Until you have access to those files, apply these structural rules as a minimum baseline:

### 3.1 Risk Banner (Warning / Danger)
- Full-width bar, positioned above the primary action button
- Contains: icon + severity label + one plain-language sentence describing the risk
- Danger banners include a "Learn more" link or expandable detail section

### 3.2 Confirmation Modal (Destructive Actions)
Required for: unlimited approve, first-time contract interaction, unverified contract, policy
violation warning.

- Requires an explicit affirmative action (dedicated confirm button, not backdrop click)
- Danger-level modals are not dismissible by clicking outside
- Displays the full contract or recipient address — no truncation inside the modal
- Confirm button label describes the action, not just "OK" (e.g., "I understand, approve anyway")

### 3.3 Address Display
- Monospace font in all address contexts
- Full address on confirmation screens; truncation only permitted in non-action list views
- One-click copy with visible "Copied" feedback and a verification nudge
- Verification status badge (Verified / Unverified / Blacklisted) adjacent to the address

### 3.4 Transaction Summary Card
Render before every sign action:

1. Action type (Transfer / Approve / Custom Contract Call)
2. Target contract or recipient with verification badge
3. Asset and amount (highlight if unlimited)
4. Estimated gas / fee
5. Risk level badge matching the severity system in Section 2.2

---

## 4. Token Core CLI Security Integration

When helping users implement security checks using the Token Core CLI
(branch: `demo/token-core-cli`), reference the following.

### 4.1 Transaction Analysis (Pre-Sign)

```bash
npm run cli -- analyze --chain eth-sepolia \
  --input '{"chainId":11155111,"account":"0x...","to":"0x...","data":"0x...","value":"0"}' \
  --policy ./src/policies/default-risk-policy.json
```

Output includes a human-readable function summary, policy check result (pass / warn / block),
and Tenderly simulation result (asset delta, revert risk). Call this before presenting the
sign confirmation to the user.

### 4.2 Policy-Gated Signing

```bash
npm run cli -- sign --chain eth-sepolia \
  --input '<tx-request-json>' \
  --wallet <wallet-name> \
  --policy ./src/policies/default-risk-policy.json
```

If a policy rule is violated, the CLI exits with a non-zero code and prints the violated rule.
Map the exit state to the appropriate severity level in your UI.

### 4.3 CLI Output → UI Risk Level Mapping

| CLI output state | UI treatment |
|-----------------|-------------|
| Contract unverified on Etherscan / Sourcify | Warning banner + user confirmation |
| Function selector unrecognized (4byte miss) | Warning banner + show raw calldata |
| Tenderly simulation failed or reverted | Danger modal + strong cancellation recommendation |
| Policy rule violated | Block — hard stop with rule explanation |
| No API key, local rules only | Info note: "Result based on local rules, not full simulation" |

### 4.4 Policy Files

Built-in examples live in `src/policies/`. Default to `default-risk-policy.json` for general
use. Suggest users review and customize the policy file as part of their wallet's security
design — the policy file itself is a meaningful design artifact.

---

## 5. Activity-Specific Safety Boundaries

Communicate these constraints to users when generating any demo or submission-related code.
They come directly from the official co-creation activity rules (Section 5).

- **Testnet first:** Recommend Sepolia or Base Sepolia for all demonstrations
- **No real mnemonic input:** Users must not enter their real mnemonic into any demo, AI tool,
  or uncontrolled environment — ever
- **Asset isolation:** If mainnet is used, only a small, disposable amount for demonstration
- **Key material stays local:** Mnemonic and private key must never be transmitted to any server
  in a demo wallet
- **Safety statement required:** Submissions must state whether real assets are involved and
  how user key data is protected; help users draft this accurately based on their actual
  implementation

---

## 6. Pre-Generation Checklist

Before generating any security-sensitive wallet feature, mentally run through this list:

- [ ] Does this feature handle mnemonic or private key? → Key material must never leave the device
- [ ] Does this feature involve signing? → Decode and display full intent before confirm is active
- [ ] Does this feature grant token approvals? → Show exact amount; Danger warning on unlimited
- [ ] Does this feature display transaction history? → Filter dust / zero-value transfers
- [ ] Does this feature show addresses? → Full address on confirm screens; address book encouraged
- [ ] Does this feature interact with a contract? → Show verification status and policy result
- [ ] Does this feature render a risk UI component? → Follow token-ui AGENTS.md / CLAUDE.md first
