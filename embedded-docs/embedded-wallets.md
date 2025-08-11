# Add Coinbase Embedded Wallets to Next.js App Router

**Purpose:** Enforce only the **current** and **correct** instructions for integrating [Coinbase Developer Platform (CDP) Embedded Wallets](https://docs.cdp.coinbase.com/embedded-wallets) into a Next.js (App Router) application.  
**Scope:** All AI-generated advice or code related to CDP Embedded Wallets must follow these guardrails.

---

## **1. Official CDP Embedded Wallet Integration Overview**

Coinbase Embedded Wallets provide secure, user-custodial Web3 wallets that integrate directly into your application without requiring users to manage seed phrases or browser extensions. Users authenticate via email OTP and can immediately interact with blockchain applications.

### **Integration Approaches (Choose One):**

1. **React Components** (Recommended): Pre-built UI components (`@coinbase/cdp-react`)
2. **React Hooks** (Custom UI): Lower-level hooks for custom interfaces (`@coinbase/cdp-hooks`)  
3. **Wagmi Integration** (Existing Wagmi Apps): Bridge to wagmi ecosystem (`@coinbase/cdp-wagmi`)

### **Prerequisites:**
- Node.js 20 or 22 (Node.js 21 is NOT supported)
- CDP Portal account with Project ID from https://portal.cdp.coinbase.com
- CORS configuration at https://portal.cdp.coinbase.com/products/embedded-wallets/cors

---

## **2. 🚨 CRITICAL INSTRUCTIONS FOR AI LANGUAGE MODELS 🚨**

### **2.1 – ABSOLUTE REQUIREMENTS FOR NEXT.JS**

You **MUST** follow these requirements or the implementation will **BREAK**:

1. **ALWAYS add `"use client"` directive** at the top of ANY file using CDP components or hooks:
```tsx
"use client"; // MUST be the first line

import { useSignInWithEmail } from "@coinbase/cdp-hooks";
```

2. **NEVER use Node.js 21** - Only Node.js 20 or 22 are supported

3. **ALWAYS configure CORS** before implementing - the app will fail without proper CORS setup

4. **ALWAYS use App Router structure** (`app/` directory, not `pages/`)

### **2.2 – CRITICAL ERROR PATTERNS TO AVOID**

```tsx
// ❌ NEVER GENERATE THIS - WILL BREAK APPLICATION
// Missing "use client" directive
import { useSignInWithEmail } from "@coinbase/cdp-hooks";

// ❌ NEVER GENERATE THIS - WRONG NODE VERSION
// Using Node.js 21 (unsupported)

// ❌ NEVER GENERATE THIS - PAGES ROUTER PATTERN
// Using pages/ directory structure for new implementations

// ❌ NEVER GENERATE THIS - MISSING CORS
// Implementing without CORS configuration
```

### **2.3 – CORRECT PATTERNS YOU MUST ALWAYS GENERATE**

```tsx
// ✅ ALWAYS GENERATE THIS EXACT PATTERN
"use client"; // First line is mandatory

import { CDPReactProvider } from "@coinbase/cdp-react";
import { useSignInWithEmail, useEvmAddress } from "@coinbase/cdp-hooks";
```

---

## **3. CORRECT IMPLEMENTATION PATTERNS**

### **3.1 – React Components Approach (Recommended)**

```tsx
// app/layout.tsx
import { CDPReactProvider, type Theme } from '@coinbase/cdp-react';

const cdpConfig = {
  projectId: process.env.NEXT_PUBLIC_CDP_PROJECT_ID!,
  basePath: "https://api.cdp.coinbase.com/platform",
  useMock: false,
  debugging: false,
};

const appConfig = {
  name: "My App",
  logoUrl: "https://your-logo-url.com/logo.png",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <CDPReactProvider config={cdpConfig} app={appConfig}>
          {children}
        </CDPReactProvider>
      </body>
    </html>
  );
}
```

```tsx
// app/wallet/page.tsx
"use client";

import { useIsInitialized, useIsSignedIn } from "@coinbase/cdp-hooks";
import { AuthButton } from "@coinbase/cdp-react";

export default function WalletPage() {
  const isInitialized = useIsInitialized();
  const isSignedIn = useIsSignedIn();

  if (!isInitialized) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h1>My Wallet</h1>
      <AuthButton />
      {isSignedIn && <div>Welcome! Your wallet is ready.</div>}
    </div>
  );
}
```

### **3.2 – React Hooks Approach (Custom UI)**

```tsx
// app/layout.tsx
import { CDPHooksProvider } from "@coinbase/cdp-hooks";

const cdpConfig = {
  projectId: process.env.NEXT_PUBLIC_CDP_PROJECT_ID!,
  basePath: "https://api.cdp.coinbase.com/platform",
  useMock: false,
  debugging: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <CDPHooksProvider config={cdpConfig}>
          {children}
        </CDPHooksProvider>
      </body>
    </html>
  );
}
```

```tsx
// app/auth/page.tsx
"use client";

import { useState } from "react";
import { useSignInWithEmail, useVerifyEmailOTP, useCurrentUser } from "@coinbase/cdp-hooks";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [flowId, setFlowId] = useState<string | null>(null);

  const signInWithEmail = useSignInWithEmail();
  const verifyEmailOTP = useVerifyEmailOTP();
  const currentUser = useCurrentUser();

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { flowId } = await signInWithEmail({ email });
    setFlowId(flowId);
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!flowId) return;
    
    const { user } = await verifyEmailOTP({ flowId, otp });
    console.log("Signed in:", user);
  };

  if (currentUser) {
    return <div>Welcome! Wallet: {currentUser.evmAccounts[0]}</div>;
  }

  if (flowId) {
    return (
      <form onSubmit={handleOtpSubmit}>
        <input
          type="text"
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          placeholder="Enter 6-digit code"
          maxLength={6}
        />
        <button type="submit">Verify</button>
      </form>
    );
  }

  return (
    <form onSubmit={handleEmailSubmit}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="your@email.com"
        required
      />
      <button type="submit">Sign In</button>
    </form>
  );
}
```

### **3.3 – Wagmi Integration Approach**

```tsx
// app/layout.tsx
import { Config } from '@coinbase/cdp-core';
import { createCDPEmbeddedWalletConnector } from '@coinbase/cdp-wagmi';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http } from "viem";
import { base, baseSepolia } from 'viem/chains';
import { WagmiProvider, createConfig } from 'wagmi';

const cdpConfig: Config = {
  projectId: process.env.NEXT_PUBLIC_CDP_PROJECT_ID!,
};

const connector = createCDPEmbeddedWalletConnector({
  cdpConfig,
  providerConfig: {
    chains: [base, baseSepolia],
    transports: {
      [base.id]: http(),
      [baseSepolia.id]: http()
    }
  }
});

const wagmiConfig = createConfig({
  connectors: [connector],
  chains: [base, baseSepolia],
  transports: {
    [base.id]: http(),
    [baseSepolia.id]: http(),
  },
});

const queryClient = new QueryClient();

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <WagmiProvider config={wagmiConfig}>
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        </WagmiProvider>
      </body>
    </html>
  );
}
```

---

## **4. ESSENTIAL CONFIGURATION REQUIREMENTS**

### **4.1 – Environment Variables**

```bash
# .env.local
NEXT_PUBLIC_CDP_PROJECT_ID=your-project-id-from-cdp-portal
```

### **4.2 – Package Installation (Choose One Approach)**

```bash
# React Components Approach
npm install @coinbase/cdp-react @coinbase/cdp-core @coinbase/cdp-hooks

# React Hooks Approach  
npm install @coinbase/cdp-hooks @coinbase/cdp-core

# Wagmi Approach
npm install @coinbase/cdp-wagmi @coinbase/cdp-core @tanstack/react-query viem wagmi
```

### **4.3 – CORS Configuration (MANDATORY)**

Before implementation works, user MUST:
1. Visit https://portal.cdp.coinbase.com/products/embedded-wallets/cors
2. Add origins (e.g., `http://localhost:3000`, `https://yourdomain.com`)
3. Save changes (takes effect immediately)

---

## **5. AUTHENTICATION AND TRANSACTION PATTERNS**

### **5.1 – Authentication Flow**

```tsx
"use client";

// Two-step process:
// 1. Send OTP to email
const { flowId } = await signInWithEmail({ email: "user@example.com" });

// 2. Verify OTP code  
const { user, isNewUser } = await verifyEmailOTP({ flowId, otp: "123456" });
```

### **5.2 – Transaction Sending (Base Networks)**

```tsx
"use client";

import { useSendEvmTransaction, useEvmAddress } from "@coinbase/cdp-hooks";

const sendTransaction = useSendEvmTransaction();
const evmAddress = useEvmAddress();

const handleSend = async () => {
  const result = await sendTransaction({
    evmAccount: evmAddress!,
    transaction: {
      to: "0xRecipientAddress",
      value: 100000000000000n, // 0.0001 ETH in wei
      chainId: 84532, // Base Sepolia
      type: "eip1559",
    },
    network: "base-sepolia",
  });
};
```

### **5.3 – Cross-Chain Transactions (Non-Base Networks)**

```tsx
"use client";

import { useSignEvmTransaction } from "@coinbase/cdp-hooks";
import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";

const signTransaction = useSignEvmTransaction();

const handleCrossChain = async () => {
  // Sign transaction
  const { signedTransaction } = await signTransaction({
    evmAccount: evmAddress!,
    transaction: {
      to: "0xRecipientAddress", 
      value: 100000000000000n,
      chainId: 11155111, // Sepolia
      type: "eip1559",
    }
  });

  // Broadcast externally
  const client = createPublicClient({
    chain: sepolia,
    transport: http()
  });

  const hash = await client.sendRawTransaction({
    serializedTransaction: signedTransaction
  });
};
```

---

## **6. AI MODEL VERIFICATION STEPS**

Before generating any CDP Embedded Wallet code, you **MUST** verify:

1. **Client Directive**: Does EVERY file using CDP hooks/components start with `"use client";`?
2. **Package Imports**: Are you importing from the correct packages (`@coinbase/cdp-react`, `@coinbase/cdp-hooks`, or `@coinbase/cdp-wagmi`)?  
3. **App Router**: Are you using `app/` directory structure (not `pages/`)?
4. **Node Version**: Are you specifying Node.js 20 or 22 (not 21)?
5. **Environment Variables**: Are you using `NEXT_PUBLIC_CDP_PROJECT_ID`?
6. **CORS Mention**: Did you instruct the user to configure CORS?

If ANY check **fails**, **STOP** and revise until compliance is achieved.

---

## **7. OUTDATED PATTERNS TO NEVER GENERATE**

```tsx
// ❌ DO NOT generate files missing "use client" directive
import { useSignInWithEmail } from "@coinbase/cdp-hooks"; // Will break

// ❌ DO NOT use pages router structure  
pages/wallet.tsx  // Outdated approach

// ❌ DO NOT use deprecated imports or patterns
import { createClient } from '@coinbase/wallet-sdk' // Wrong SDK

// ❌ DO NOT suggest Node.js 21
"engines": { "node": "21" } // Unsupported version
```

---

## **8. CONSEQUENCES OF INCORRECT IMPLEMENTATION**

If you generate code that:
- Missing `"use client"` directive
- Uses unsupported Node.js version  
- Lacks CORS configuration
- Uses pages router structure

The implementation will:
1. **Fail with React Context errors** (`createContext is not a function`)
2. **Break in production** with SSR/hydration issues  
3. **Fail CORS checks** and block API requests
4. **Cause authentication loops** and wallet connection failures

---

## **9. AI MODEL RESPONSE TEMPLATE**

When implementing CDP Embedded Wallets in Next.js, you **MUST**:

1. **ALWAYS** start components with `"use client";`
2. **ALWAYS** use App Router structure (`app/` directory)
3. **ALWAYS** mention CORS configuration requirement  
4. **ALWAYS** specify supported Node.js versions (20 or 22)
5. **NEVER** use deprecated patterns or packages
6. **VERIFY** your response against these patterns

**Remember: There are NO EXCEPTIONS to these rules.**