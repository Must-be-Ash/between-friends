# React Hooks

## Overview

CDP provides React hooks for conveniently accessing the CDP Embedded Wallet SDK functionality. Built on top of `@coinbase/cdp-core`, these hooks offer a React-friendly interface for authentication and embedded wallet operations.

<Accordion title="Available hooks">
  ### Auth and user management

  * `useSignInWithEmail` - Initiate email authentication flow
  * `useVerifyEmailOTP` - Verify OTP code sent to email
  * `useCurrentUser` - Get the current authenticated user
  * `useIsSignedIn` - Check if user is signed in
  * `useSignOut` - Sign out the current user

  ### Wallet operations

  * `useEvmAddress` - Get the primary EVM wallet address
  * `useEvmAccounts` - Get all EVM accounts
  * `useSendEvmTransaction` - Send transactions on Base networks (Base and Base Sepolia only)
  * `useSignEvmTransaction` - Sign transactions for any EVM network
  * `useSignEvmMessage` - Sign plain text messages
  * `useSignEvmTypedData` - Sign EIP-712 typed data
  * `useSignEvmHash` - Sign message hashes
  * `useExportEvmAccount` - Export wallet private key

  ### SDK state

  * `useIsInitialized` - Check if SDK is ready
  * `useConfig` - Access CDP configuration
</Accordion>

## Prerequisites

* [Node.js 20 or 22](https://nodejs.org/en/download) installed (Node.js 21 is not supported)
* Package manager (`npm`, `pnpm`, or `yarn`)
* A free [CDP Portal](https://portal.cdp.coinbase.com) account
* Basic familiarity with React

### 1. Installation

Install the required packages:

```bash
# npm
npm install @coinbase/cdp-core @coinbase/cdp-hooks @coinbase/cdp-react

# pnpm
pnpm add @coinbase/cdp-core @coinbase/cdp-hooks @coinbase/cdp-react

# yarn
yarn add @coinbase/cdp-core @coinbase/cdp-hooks @coinbase/cdp-react
```

### 2. Obtain your Project ID

Gather your CDP Project information:

1. Sign in or create an account on the [CDP Portal](https://portal.cdp.coinbase.com)
2. On your dashboard, select a project from the dropdown at the top, and copy the Project ID

### 3. Setup hooks provider

Next, set up the `CDPHooksProvider` in your application:

<Accordion title="Using Next.js?">
  Add `"use client"` as the first line of any file using CDP hooks:

  ```tsx
  "use client"; // Must be the first line in the file

  import { useSignInWithEmail, useEvmAddress } from "@coinbase/cdp-hooks";

  export default function MyComponent() {
    const signIn = useSignInWithEmail();
    const address = useEvmAddress();
    // Your component code
  }
  ```

  This tells Next.js to render this component on the client side, which is required for React Context and hooks.
</Accordion>

```tsx
import { CDPHooksProvider } from "@coinbase/cdp-hooks";

function App() {
  return (
    <CDPHooksProvider 
      config={{
        projectId: "your-project-id",
        basePath: "https://api.cdp.coinbase.com/platform", // CDP API url
        useMock: false, // Use live APIs or use mock data for testing
        debugging: false, // Log API requests and responses
      }}
    >
      <YourApp />
    </CDPHooksProvider>
  );
}
```

### 4. Ensure SDK initialization

Finally, ensure the SDK is initialized before authenticating a user or performing wallet operations:

```tsx
import { useIsInitialized } from "@coinbase/cdp-hooks";

function App() {
  const isInitialized = useIsInitialized();

  if (!isInitialized) {
    return <div>Loading...</div>;
  }

  return <Page />;
}
```

## Examples

### User sign-in

Our authentication uses a two-step flow:

1. Submit user email to initiate the authentication flow, which will send the user a One-Time-Password (OTP) and return a `flowId`
2. Submit the six-digit OTP and `flowId`, after which the user will be authenticated, returning a User object

```tsx
import { useSignInWithEmail, useVerifyEmailOTP } from "@coinbase/cdp-hooks";

function SignIn() {
  const signInWithEmail = useSignInWithEmail();
  const verifyEmailOTP = useVerifyEmailOTP();

  const handleSignIn = async (email: string) => {
    try {
      // Start sign in flow
      const { flowId } = await signInWithEmail({ email });

      // Get OTP from user input...
      const otp = "123456";

      // Complete sign in
      const { user, isNewUser } = await verifyEmailOTP({
        flowId,
        otp
      });

      console.log("Signed in user:", user);
      console.log("User EVM address", user.evmAccounts[0]);
    } catch (error) {
      console.error("Sign in failed:", error);
    }
  };

  return <button onClick={() => handleSignIn("user@example.com")}>Sign In</button>;
}
```

### View user profile

```tsx
import { useCurrentUser, useEvmAddress } from "@coinbase/cdp-hooks";

function Profile() {
  const user = useCurrentUser();
  const primaryAddress = useEvmAddress();

  if (!user) {
    return <div>Please sign in</div>;
  }

  return (
    <div>
      <h2>Profile</h2>
      <p>User ID: {user.userId}</p>
      <p>Primary Address: {primaryAddress}</p>
      <p>All Accounts: {user.evmAccounts.join(", ")}</p>
    </div>
  );
}
```

### Send a transaction

We support signing and sending a Blockchain transaction in a single action on Base or Base Sepolia. For other networks, see the section below.

```tsx
import { useSendEvmTransaction, useEvmAddress } from "@coinbase/cdp-hooks";

function SendTransaction() {
  const sendTransaction = useSendEvmTransaction();
  const evmAddress = useEvmAddress();

  const handleSend = async () => {
    if (!evmAddress) return;

    try {
      const result = await sendTransaction({
        evmAccount: evmAddress,
        transaction: {
          to: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
          value: 100000000000000n, // 0.0001 ETH in wei
          nonce: 0,
          gas: 21000n,
          maxFeePerGas: 30000000000n,
          maxPriorityFeePerGas: 1000000000n,
          chainId: 84532, // Base Sepolia
          type: "eip1559",
        }
      });

      console.log("Transaction hash:", result.transactionHash);
    } catch (error) {
      console.error("Transaction failed:", error);
    }
  };

  return <button onClick={handleSend}>Send Transaction</button>;
}
```

### Sign and broadcast (non-Base networks)

For networks other than Base or Base Sepolia, you can sign a transaction with the wallet and broadcast it yourself. This example uses the public client from `viem` to broadcast the transaction.

```tsx
import { useSignEvmTransaction, useEvmAddress } from "@coinbase/cdp-hooks";
import { http, createPublicClient } from "viem";
import { sepolia } from "viem/chains";

function CrossChainTransaction() {
  const signTransaction = useSignEvmTransaction();
  const evmAddress = useEvmAddress();

  const handleSend = async () => {
    if (!evmAddress) return;

    try {
      // Sign the transaction
      const { signedTransaction } = await signTransaction({
        evmAccount: evmAddress,
        transaction: {
          to: "0x...",
          value: 100000000000000n,
          nonce: 0,
          gas: 21000n,
          maxFeePerGas: 30000000000n,
          maxPriorityFeePerGas: 1000000000n,
          chainId: 11155111, // Sepolia
          type: "eip1559",
        }
      });

      // Broadcast using a different client
      const client = createPublicClient({
        chain: sepolia,
        transport: http()
      });

      const hash = await client.sendRawTransaction({
        serializedTransaction: signedTransaction
      });

      console.log("Transaction hash:", hash);
    } catch (error) {
      console.error("Transaction failed:", error);
    }
  };

  return <button onClick={handleSend}>Send Transaction</button>;
}
```

### Sign messages and typed data

You can sign EVM messages, hashes, and typed data to generate signatures for various on-chain applications.

```tsx
import { useSignEvmMessage, useSignEvmTypedData, useSignEvmHash, useEvmAddress } from "@coinbase/cdp-hooks";

function SignData() {
  const signMessage = useSignEvmMessage();
  const signTypedData = useSignEvmTypedData();
  const signHash = useSignEvmHash();
  const evmAddress = useEvmAddress();

  const handleSignMessage = async () => {
    if (!evmAddress) return;

    const result = await signMessage({
      evmAccount: evmAddress,
      message: "Hello World"
    });

    console.log("Message signature:", result.signature);
  };

  const handleSignTypedData = async () => {
    if (!evmAddress) return;

    const result = await signTypedData({
      evmAccount: evmAddress,
      typedData: {
        domain: {
          name: "Example DApp",
          version: "1",
          chainId: 84532,
        },
        types: {
          Person: [
            { name: "name", type: "string" },
            { name: "wallet", type: "address" }
          ]
        },
        primaryType: "Person",
        message: {
          name: "Bob",
          wallet: evmAddress
        }
      }
    });

    console.log("Typed data signature:", result.signature);
  };

  const handleSignHash = async () => {
    if (!evmAddress) return;

    const result = await signHash({
      evmAccount: evmAddress,
      hash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
    });

    console.log("Hash signature:", result.signature);
  };

  return (
    <div>
      <button onClick={handleSignMessage}>Sign Message</button>
      <button onClick={handleSignTypedData}>Sign Typed Data</button>
      <button onClick={handleSignHash}>Sign Hash</button>
    </div>
  );
}
```

### Export private keys

We allow the user of an embedded wallet to export their private key, allowing them to import it into an EVM-compatible wallet of their choice.

```tsx
import { useExportEvmAccount, useEvmAddress } from "@coinbase/cdp-hooks";

function ExportKey() {
  const exportAccount = useExportEvmAccount();
  const evmAddress = useEvmAddress();

  const handleExport = async () => {
    if (!evmAddress) return;

    try {
      const { privateKey } = await exportAccount({
        evmAccount: evmAddress
      });

      console.log("Private Key:", privateKey);
      // Warning: Handle private keys with extreme care!
    } catch (error) {
      console.error("Export failed:", error);
    }
  };

  return <button onClick={handleExport}>Export Private Key</button>;
}
```
