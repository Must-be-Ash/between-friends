# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Plan & Review

### Before starting work
- Always in plan mode to make a plan
- After get the plan, make sure you Write the plan to •claude/tasks/TASK_NAME. md.
- The plan should be a detailed implementation plan and the reasoning behind them, as well as tasks broken down.
- If the task require external knowledge or certain package, also research to get latest knowledge (Use Task tool for research)
- Don't over plan it, always think MVP. Do not include future work, budget or buisness related things like week 1, week 2... .
- Once you write the plan, firstly ask me to review it. Do not continue until I approve the plan.
### While implementing
- You should update the plan as you work.
- After you complete tasks in the plan, you should update and append detailed descriptions of the changes you made, so following tasks can be easily hand over to other engineers.

## Rule Updates:
- **Add New Rules When:**
- A new technology/pattern is used in 3+ files
- Common bugs could be prevented by a rule
- Code reviews repeatedly mention the same feedback
- New security or performance patterns emerge
- **Modify Existing Rules When:**
- Better examples exist in the codebase
- Additional edge cases are discovered
- Related rules have been updated
- Implementation details have changed

## Repository Overview

This repository contains documentation and planning materials for Coinbase Developer Platform (CDP) integration, specifically focused on:

- **Embedded Wallets Documentation**: Comprehensive guides for integrating CDP embedded wallets
- **Onramp APIs Documentation**: API references for fiat-to-crypto purchase flows
- **Between Friends Project Planning**: PRD and architectural planning for a USDC transfer application

## Repository Structure

### Documentation Directories

- `embedded-docs/`: CDP embedded wallet documentation
  - `overview.md` - Key benefits, security, and use cases
  - `quickstart.md` - 5-minute integration guide with React
  - `react-components.md` - Pre-built UI components
  - `react-hooks.md` - Authentication and transaction hooks
  - `wagmi.md` - Wagmi library integration
  - `cors-configuration.md` - Security configuration

- `onramp-docs/`: Onramp API documentation  
  - `onramp-overview.md` - Countries, payment methods, rate limits
  - `generating-quotes.md` - Price quotation API
  - `apple-pay-onramp-api.md` - Apple Pay integration
  - `session-token-authentication.md` - Secure widget initialization
  - `transaction-status.md` - Real-time status tracking
  - `payment-methods.md` - Supported payment options
  - `countries-&-currencies.md` - Geographic availability

### Project Planning Files

- `prd.md` - Technical PRD for email-based USDC transfers with escrow
- `project-breakdown.md` - Detailed architecture and implementation plan
- `CLAUDE.md` - This guidance file

## Key Technologies Covered

### CDP Embedded Wallets
- **Authentication**: Email OTP, Google, Apple sign-in (no seed phrases)
- **Security**: Trusted Execution Environment (TEE), user-custodied
- **Networks**: Base mainnet (8453), Base Sepolia testnet (84532)
- **Integration**: `@coinbase/cdp-react`, `@coinbase/cdp-hooks` packages

### Onramp APIs
- **Payment Methods**: Debit cards, bank accounts, Apple Pay
- **Geography**: US focus with guest checkout ($500/week limit)
- **Rate Limits**: 10 requests/second per endpoint
- **Authentication**: Session tokens for secure widget initialization

## Development Patterns from Documentation

### Required Environment Setup
```bash
# CDP Configuration
NEXT_PUBLIC_CDP_PROJECT_ID=your-project-id
NEXT_PUBLIC_BASE_RPC_URL=https://sepolia.base.org
```

### Essential React Integration
- All CDP components require `"use client"` directive (Next.js App Router)
- Wrap app with `CDPReactProvider` using project ID
- Configure CORS allowlist in CDP Portal before testing
- Use Node.js 20 or 22 (Node.js 21 not supported)

### Common Hook Patterns
```tsx
// Authentication state
const isInitialized = useIsInitialized();
const isSignedIn = useIsSignedIn();
const evmAddress = useEvmAddress();

// Transaction handling  
const sendEvmTransaction = useSendEvmTransaction();
```

### Transaction Configuration
- Use EIP-1559 transaction type for Base network
- Gas estimation handled automatically by CDP
- Base Sepolia testnet for development (chainId: 84532)
- Production on Base mainnet (chainId: 8453)

## Security Guidelines

### CDP Integration Security
- Project IDs should be in environment variables, not hardcoded
- CORS configuration must be set up in CDP Portal
- Session tokens are managed automatically by CDP
- Private keys never exposed - handled by TEE infrastructure

### Network-Specific Considerations
- `useSendEvmTransaction()` limited to Base and Base Sepolia
- `useSignEvmTransaction()` supports any EVM network
- Base Sepolia faucet available at portal.cdp.coinbase.com/products/faucet

## Documentation Maintenance

This repository contains only documentation files (markdown). There are no:
- Build commands or scripts
- Test suites to run
- Dependencies to install
- Linting or formatting commands

When working with this repository:
1. Edit documentation files directly
2. Ensure markdown syntax is clean and readable  
3. Maintain consistent structure across similar doc types
4. Update cross-references when moving or renaming files
5. Keep technical details current with CDP API changes