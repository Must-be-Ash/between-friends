========================
CODE SNIPPETS
========================
TITLE: CDP SDK Gas Sponsorship for Generic Accounts via CDP Paymaster
DESCRIPTION: Shows how even generic accounts can utilize CDP Paymaster for gas sponsorship by specifying 'base' as the network during a user operation. This highlights the flexibility of the Paymaster integration, extending gas sponsorship benefits to any account type on the Base network.

SOURCE: https://docs.cloud.coinbase.com/wallet-api/v2/evm-features/managed-mode

LANGUAGE: TypeScript
CODE:
```
import { CdpClient } from "@coinbase/cdp-sdk";
import "dotenv/config";

const cdp = new CdpClient();

const account = await cdp.evm.getOrCreateAccount({
  name: "My-Account",
});

const smartAccount = await cdp.evm.getOrCreateSmartAccount({
  name: "My-Smart-Account",
  owner: account,
});

// Automatically uses CDP Paymaster for gas sponsorship.
const userOperation = await smartAccount.sendUserOperation({
  network: "base",
  calls: [
    {
      to: "0x0000000000000000000000000000000000000000",
      value: 0n,
      data: "0x",
    },
  ],
});

const receipt = await smartAccount.waitForUserOperation(userOperation);
console.log("User operation confirmed:", receipt);
```

----------------------------------------

TITLE: CDP SDK Gas Sponsorship for Smart Accounts via CDP Paymaster
DESCRIPTION: Demonstrates how the Coinbase CDP SDK automatically uses CDP Paymaster for gas sponsorship with smart accounts on Base. This snippet shows creating and scoping a smart account to 'base', then sending a user operation where gas fees are sponsored, eliminating the need for the account to hold ETH.

SOURCE: https://docs.cloud.coinbase.com/wallet-api/v2/evm-features/managed-mode

LANGUAGE: TypeScript
CODE:
```
import { CdpClient } from "@coinbase/cdp-sdk";
import "dotenv/config";

const cdp = new CdpClient();

const account = await cdp.evm.getOrCreateAccount({
  name: "My-Account",
});

const smartAccount = await cdp.evm.getOrCreateSmartAccount({
  name: "My-Smart-Account",
  owner: account,
});

// Scope an account instance to Base.
const baseSmartAccount = await smartAccount.useNetwork("base");

// Automatically uses CDP Paymaster for gas sponsorship.
const userOperation = await baseSmartAccount.sendUserOperation({
  calls: [
    {
      to: "0x0000000000000000000000000000000000000000",
      value: 0n,
      data: "0x",
    },
  ],
});

const receipt = await baseSmartAccount.waitForUserOperation(userOperation);
console.log("User operation confirmed:", receipt);
```

----------------------------------------

TITLE: Solana Gas Sponsorship with CDP SDK in TypeScript
DESCRIPTION: This TypeScript code demonstrates how to implement gas sponsorship on Solana using the Coinbase CDP SDK. It outlines the process of creating and funding a dedicated fee payer account and a source account, constructing a SOL transfer transaction, and then signing the transaction sequentially with both accounts, ensuring the fee payer covers the network fees.

SOURCE: https://docs.cloud.coinbase.com/wallet-api/v2/solana-features/sponsor-transactions

LANGUAGE: TypeScript
CODE:
```
    import { CdpClient } from "@coinbase/cdp-sdk";
    import "dotenv/config";

    import {
      Connection,
      PublicKey,
      SystemProgram,
      Transaction,
    } from "@solana/web3.js";

    async function main(sourceAddress?: string) {
      const cdp = new CdpClient();

      // Required: Destination address to send SOL to
      const destinationAddress = "3KzDtddx4i53FBkvCzuDmRbaMozTZoJBb1TToWhz3JfE";

      // Amount of lamports to send (default: 1000 = 0.000001 SOL)
      const lamportsToSend = 1000;

      try {
        const connection = new Connection("https://api.devnet.solana.com");

        // Set up a dedicated fee payer account.
        const feePayer = await cdp.solana.getOrCreateAccount({
          name: "test-sol-account-fee-payer",
        });
        console.log("Fee payer address: " + feePayer.address);

        // Request funds on the feePayer address to pay for the gas.
        await requestFaucetAndWaitForBalance(cdp, feePayer.address, connection);

        let fromAddress: string;
        if (sourceAddress) {
          fromAddress = sourceAddress;
          console.log("Using existing SOL account:", fromAddress);
        } else {
          // Set up a source account.
          const account = await cdp.solana.getOrCreateAccount({
            name: "test-sol-account",
          })

          fromAddress = account.address;
          console.log("Successfully created new SOL account:", fromAddress);

          // Request funds on the source account for transaction amount.
          await requestFaucetAndWaitForBalance(cdp, fromAddress, connection);
        }

        const balance = await connection.getBalance(new PublicKey(fromAddress));
        if (balance < lamportsToSend) {
          throw new Error(
            `Insufficient balance: ${balance} lamports, need at least ${lamportsToSend} lamports`
          );
        }

        const transaction = new Transaction();
        transaction.add(
          SystemProgram.transfer({
            fromPubkey: new PublicKey(fromAddress),
            toPubkey: new PublicKey(destinationAddress),
            lamports: lamportsToSend,
          })
        );

        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = new PublicKey(feePayer.address);

        const serializedTx = Buffer.from(
          transaction.serialize({ requireAllSignatures: false })
        ).toString("base64");

        // Sign with the funding account.
        const signedTxResponse = await cdp.solana.signTransaction({
          address: fromAddress,
          transaction: serializedTx,
        });

        const signedBase64Tx = signedTxResponse.signature;

        // Sign with the feePayer account.
        const finalSignedTxResponse = await cdp.solana.signTransaction({
          address: feePayer.address,
          transaction: signedBase64Tx,
        });

        // Send the signed transaction to the network.
        const signature = await connection.sendRawTransaction(Buffer.from(finalSignedTxResponse.signature, 'base64'));

        const latestBlockhash = await connection.getLatestBlockhash();

        const confirmation = await connection.confirmTransaction({
          signature,
          blockhash: latestBlockhash.blockhash,
          lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        });

        if (confirmation.value.err) {
          throw new Error(
            `Transaction failed: ${confirmation.value.err.toString()}`
          );
        }

        console.log(
          "Transaction confirmed:",
          confirmation.value.err ? "failed" : "success"
        );
        console.log(
          `Transaction explorer link: https://explorer.solana.com/tx/${signature}?cluster=devnet`
        );

        return {
          fromAddress,
          destinationAddress,
          amount: lamportsToSend / 1e9,
          signature,
          success: !confirmation.value.err,
        };
      } catch (error) {
        console.error("Error processing SOL transaction:", error);
        throw error;
      }
    }

    /**
     * Sleeps for a given number of milliseconds
     *
     * @param {number} ms - The number of milliseconds to sleep
     * @returns {Promise<void>} A promise that resolves when the sleep is complete
     */
    function sleep(ms: number): Promise<void> {

```

----------------------------------------

TITLE: API: requestFaucetAndWaitForBalance Function
DESCRIPTION: Documents the `requestFaucetAndWaitForBalance` function, detailing its parameters and return type for funding Solana accounts via a faucet using the CDP client.

SOURCE: https://docs.cloud.coinbase.com/wallet-api/v2/solana-features/sponsor-transactions

LANGUAGE: APIDOC
CODE:
```
requestFaucetAndWaitForBalance(
  cdp: CdpClient,
  address: string,
  connection: Connection,
): Promise<void>

Parameters:
- cdp: CdpClient - The CDP client instance.
- address: string - The address to fund.
- connection: Connection - The Solana connection.

Returns:
- Promise<void>: A promise that resolves when the account is funded.
```

----------------------------------------

TITLE: Send User Operation with Paymaster (Typescript)
DESCRIPTION: This snippet demonstrates how to send a user operation using a smart wallet in Typescript. It includes a `paymasterURL` for gas sponsorship, which is relevant for Base Mainnet. The operation involves a call to a specified address with a value.

SOURCE: https://docs.cloud.coinbase.com/wallet-api/v1/concepts/smart-wallets

LANGUAGE: Typescript
CODE:
```
const userOperation = await smartWallet.sendUserOperation({
    calls: [
        {
            to: "0x1234567890123456789012345678901234567890",
            value: parseEther("0.0000005"),
            data: "0x",
        },
    ],
    chainId: 8453,
    paymasterURL: "https://api.developer.coinbase.com/rpc/v1/base/someapikey",
});
```

----------------------------------------

TITLE: Example Contract Address for Paymaster Allowlisting
DESCRIPTION: This code snippet provides a sample contract address used in the Coinbase Paymaster configuration. It serves as an example for specifying which smart contract's functions are eligible for gas sponsorship.

SOURCE: https://docs.cloud.coinbase.com/paymaster/guides/build-sponsored-transaction-component

LANGUAGE: Plain Text
CODE:
```
0x27B535E9D8FDBCa81741e9a812Dd72656B125831
```

----------------------------------------

TITLE: Utility: Asynchronous Sleep Function
DESCRIPTION: A helper function that pauses asynchronous execution for a specified number of milliseconds using a Promise and `setTimeout`.

SOURCE: https://docs.cloud.coinbase.com/wallet-api/v2/solana-features/sponsor-transactions

LANGUAGE: TypeScript
CODE:
```
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

----------------------------------------

TITLE: Main Application Entry Point for Solana Faucet Example
DESCRIPTION: Parses an optional source address from command-line arguments and initiates the main application flow, including basic error handling for the `main` function call.

SOURCE: https://docs.cloud.coinbase.com/wallet-api/v2/solana-features/sponsor-transactions

LANGUAGE: TypeScript
CODE:
```
const sourceAddress = process.argv.length > 2 ? process.argv[2] : undefined;

main(sourceAddress).catch(console.error);
```

----------------------------------------

TITLE: Create Bundler/Paymaster Clients and Submit Transaction
DESCRIPTION: This comprehensive example demonstrates how to initialize bundler and paymaster clients using Viem's account abstraction features. It constructs a user operation for an NFT mint, estimates gas, and sends the transaction through the bundler, leveraging a paymaster for gas sponsorship. The snippet also includes logging for transaction status and error handling.

SOURCE: https://docs.cloud.coinbase.com/paymaster/guides/quickstart

LANGUAGE: JavaScript
CODE:
```
//index.js
import { http } from "viem";
import { baseSepolia } from "viem/chains";
import { createBundlerClient } from "viem/account-abstraction";
import { account, client, RPC_URL } from "./config.js";
import { abi } from "./example-app-abi.js";

// Logs your deterministic public address generated by your private key
console.log(`Minting nft to ${account.address}`)

// The bundler is a special node that gets your UserOperation on chain
const bundlerClient = createBundlerClient({
  account,
  client,
  transport: http(RPC_URL),
  chain: baseSepolia,
});

// The call for your app. You will have change this depending on your dapp's abi
const nftContractAddress = "0x66519FCAee1Ed65bc9e0aCc25cCD900668D3eD49"
const mintTo = {
  abi: abi,
  functionName: "mintTo",
  to: nftContractAddress,
  args: [account.address, 1],
};
const calls = [mintTo]

// Pads the preVerificationGas (or any other gas limits you might want) to ensure your UserOperation lands onchain
account.userOperation = {
  estimateGas: async (userOperation) => {
    const estimate = await bundlerClient.estimateUserOperationGas(userOperation);
    // adjust preVerification upward
    estimate.preVerificationGas = estimate.preVerificationGas * 2n;
    return estimate;
  },
};

// Sign and send the UserOperation
try {
  const userOpHash = await bundlerClient.sendUserOperation({
    account,
    calls,
    paymaster: true
  });

  const receipt = await bundlerClient.waitForUserOperationReceipt({
    hash: userOpHash,
  });

  console.log("✅ Transaction successfully sponsored!");
  console.log(`⛽ View sponsored UserOperation on blockscout: https://base-sepolia.blockscout.com/op/${receipt.userOpHash}`);
  console.log(`🔍 View NFT mint on basescan: https://sepolia.basescan.org/address/${account.address}`);
  process.exit()
} catch (error) {
  console.log("Error sending transaction: ", error);
  process.exit(1)
}

```

----------------------------------------

TITLE: Solana Faucet Funding and Balance Verification with CDP SDK
DESCRIPTION: Demonstrates how to request SOL from a Solana faucet for a given address using the CDP client and then repeatedly check the account balance until funds are received or a maximum number of attempts is reached. It handles the initial faucet request and subsequent balance polling.

SOURCE: https://docs.cloud.coinbase.com/wallet-api/v2/solana-features/sponsor-transactions

LANGUAGE: TypeScript
CODE:
```
async function requestFaucetAndWaitForBalance(
    cdp: CdpClient,
    address: string,
    connection: Connection,
): Promise<void> {
  // Request funds from faucet
  const faucetResp = await cdp.solana.requestFaucet({
    address: address,
    token: "sol",
  });
  console.log(
      `Successfully requested SOL from faucet:`,
      faucetResp.signature
  );

  // Wait until the address has balance
  let balance = 0;
  let attempts = 0;
  const maxAttempts = 30;

  while (balance === 0 && attempts < maxAttempts) {
    balance = await connection.getBalance(new PublicKey(address));
    if (balance === 0) {
      console.log("Waiting for funds...");
      await sleep(1000);
      attempts++;
    }
  }

  if (balance === 0) {
    throw new Error("Account not funded after multiple attempts");
  }

  console.log("Account funded with", balance / 1e9, "SOL");
  return;
}
```

----------------------------------------

TITLE: CDP Node JSON-RPC API Support for Base Networks
DESCRIPTION: This table details the available RPC namespaces and their functionalities for Base Mainnet and Base Sepolia through the CDP Node JSON-RPC API, including historical data, gas sponsorship, and EVM functionality.

SOURCE: https://docs.cloud.coinbase.com/api-reference/networks

LANGUAGE: APIDOC
CODE:
```
RPC namespace | Functionality | Base Mainnet | Base Sepolia
--- | --- | --- | ---
`cdp_*` | Historical address data | ✅ | ✅
`pm_*` | Gas sponsorship management (Paymaster) | ✅ | ✅
`eth_*` | Base-specific EVM functionality | ✅ | ✅
`web3_*` | Client information | ✅ | ✅
`debug_*` | Debug tools | ✅ | ✅
`net_*` | Network info | ✅ | ✅
```

----------------------------------------

TITLE: Call eth_feeHistory JSON-RPC Method
DESCRIPTION: Retrieves historical gas prices and base fees for a range of blocks. This method is particularly useful for clients implementing EIP-1559 to predict future gas prices and optimize transaction costs.

SOURCE: https://docs.cloud.coinbase.com/api-reference/json-rpc-api/core

LANGUAGE: Shell
CODE:
```
curl -s {Your_Endpoint_URL} -H "Content-Type: application/json" -d '{"jsonrpc": "2.0", "id": 1, "method": "eth_feeHistory", "params": [4, "latest", [25, 75]]}'
```

----------------------------------------

TITLE: Enable Transaction Sponsorship with isSponsored Prop
DESCRIPTION: This snippet demonstrates how to modify the `Transaction` component in `/src/components/TransactionWrapper.tsx` to enable transaction sponsorship by setting the `isSponsored` prop to true.

SOURCE: https://docs.cloud.coinbase.com/paymaster/introduction/quickstart

LANGUAGE: tsx
CODE:
```
      <Transaction
        isSponsored
        address={address}
        contracts={contracts}
        className="w-[450px]"
        chainId={BASE_SEPOLIA_CHAIN_ID}
        onError={handleError}
        onSuccess={handleSuccess}
      >
        <TransactionButton
          className="mt-0 mr-auto ml-auto w-[450px] max-w-full text-[white]"
          text="Collect"
        />
        <TransactionStatus>
          <TransactionStatusLabel />
          <TransactionStatusAction />
        </TransactionStatus>
      </Transaction>
```

----------------------------------------

TITLE: Deploy Gaslite Drop Smart Contract
DESCRIPTION: Deploys the Gaslite Drop smart contract to the Base Sepolia testnet using Forge. This process requires a Base Sepolia wallet private key to be set in your environment variables as PRIVATE_KEY for broadcasting the transaction.

SOURCE: https://docs.cloud.coinbase.com/get-started/demo-apps/app-examples/automated-mass-payouts

LANGUAGE: Shell
CODE:
```
cd gaslite-core
forge build
forge script script/GasliteDrop.s.sol \
  --rpc-url https://sepolia.base.org \
  --broadcast \
  --chain-id 84532
```

----------------------------------------

TITLE: Call eth_estimateGas JSON-RPC Method
DESCRIPTION: Estimates the amount of gas required for a transaction to complete successfully. This helps users set an appropriate gas limit to avoid transaction failures or overpaying for gas.

SOURCE: https://docs.cloud.coinbase.com/api-reference/json-rpc-api/core

LANGUAGE: Shell
CODE:
```
curl -s {Your_Endpoint_URL} -H "Content-Type: application/json" -d '{"jsonrpc": "2.0", "id": 1, "method": "eth_estimateGas", "params": [{"from": "0x8d97689c9818892b700e27f316cc3e41e17fbeb9", "to": "0xd3cda913deb6f67967b99d67acdfa1712c293601", "value": "0x1"}]}'
```

----------------------------------------

TITLE: Install Viem Dependency
DESCRIPTION: Installs the 'viem' library, a crucial dependency for interacting with Ethereum and Base Sepolia smart contracts, enabling transaction sending and contract calls in the project.

SOURCE: https://docs.cloud.coinbase.com/paymaster/guides/quickstart

LANGUAGE: Shell
CODE:
```
npm install viem
```

----------------------------------------

TITLE: Send User Operation for EVM Smart Account (cURL)
DESCRIPTION: This cURL command initiates a user operation for an EVM smart account. It targets a specific address, includes authentication, and defines the operation's network, calls (recipient, value, data), and an optional paymaster URL for gas sponsorship.

SOURCE: https://docs.cloud.coinbase.com/api-reference/v2/rest-api/evm-smart-accounts/prepare-a-user-operation

LANGUAGE: cURL
CODE:
```
curl --request POST \
  --url https://api.cdp.coinbase.com/platform/v2/evm/smart-accounts/{address}/user-operations \
  --header 'Authorization: Bearer <token>' \
  --header 'Content-Type: application/json' \
  --data '{ \
  "network": "base-sepolia", \
  "calls": [ \
    { \
      "to": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", \
      "value": "0", \
      "data": "0xa9059cbb000000000000000000000000fc807d1be4997e5c7b33e4d8d57e60c5b0f02b1a0000000000000000000000000000000000000000000000000000000000000064" \
    } \
  ], \
  "paymasterUrl": "https://api.developer.coinbase.com/rpc/v1/base/<token>" \
}'
```

----------------------------------------

TITLE: Define Basenames Contract Addresses for Base Sepolia (Partial)
DESCRIPTION: This JavaScript snippet defines the contract addresses for the Basenames Registrar Controller and L2 Resolver on Base Sepolia. Note that the provided code is truncated and does not include full ABI definitions.

SOURCE: https://docs.cloud.coinbase.com/get-started/demo-apps/app-examples/basename-registration

LANGUAGE: JavaScript
CODE:
```
// Base Sepolia Registrar Controller Contract Address.
const BaseNamesRegistrarControllerAddress = "0x49aE3cC2e3AA768B1e5654f5D3C6002144A59581";

// Base Sepolia L2 Resolver Contract Address.
```

----------------------------------------

TITLE: Perform EVM token swap with smart account
DESCRIPTION: This example illustrates the all-in-one approach for executing token swaps on EVM networks using a smart account. It covers creating or retrieving a smart account, performing the swap, and then waiting for the user operation to complete, including an optional paymaster URL for gas sponsorship.

SOURCE: https://docs.cloud.coinbase.com/sdks/cdp-sdks-v2/python

LANGUAGE: python
CODE:
```
from cdp import CdpClient
from cdp.actions.evm.swap import SmartAccountSwapOptions

async with CdpClient() as cdp:
    # Create or retrieve a smart account with funds already in it
    owner = await cdp.evm.get_or_create_account(name="MyOwnerAccount")
    smart_account = await cdp.evm.get_or_create_smart_account(name="MyExistingFundedSmartAccount", owner=owner)

    # Execute a swap directly on a smart account in one line
    result = await smart_account.swap(
        SmartAccountSwapOptions(
            network="base",
            from_token="0x4200000000000000000000000000000000000006",  # WETH on Base
            to_token="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",  # USDC on Base
            from_amount="1000000000000000000",  # 1 WETH (18 decimals)
            slippage_bps=100  # 1% slippage tolerance
            # Optional: paymaster_url="https://paymaster.example.com"  # For gas sponsorship
        )
    )
    print(f"User operation hash: {result.user_op_hash}")

    # Wait for the user operation to complete
    receipt = await smart_account.wait_for_user_operation(user_op_hash=result.user_op_hash)
    print(f"Status: {receipt.status}")

```

----------------------------------------

TITLE: Estimate UserOperation Gas (eth_estimateUserOperationGas)
DESCRIPTION: Documents the `eth_estimateUserOperationGas` method, used to estimate gas values for a UserOperation. It specifies the UserOperation and entryPoint parameters, highlighting that the signature field can be a dummy value but should match the actual signature size for accuracy.

SOURCE: https://docs.cloud.coinbase.com/api-reference/json-rpc-api/paymaster

LANGUAGE: APIDOC
CODE:
```
Method: eth_estimateUserOperationGas
Description: This endpoint will estimate the gas values for a UserOperation. The signature field is ignored and can be a dummy value, but is recommended to be of the same size as an actual signature for an accurate estimate.
Parameters:
  - UserOperation: UserOperation (Required) - The UserOperation. You can use a dummy signature but the signature must be the correct size for an accurate gas estimate.
  - entryPoint: string (Required) - EntryPoint address that the UserOperation is intended for.
Returns:
  - preVerificationGas: Amount of gas to compensate the bundler for pre-verification execution and calldata
  - verificationGasLimit: Amount of gas to allocate for the verification step
  - callGasLimit: Amount of gas to allocate the main execution call
```

LANGUAGE: JSON
CODE:
```
{
  "jsonrpc": "2.0",
   "id": 1,
  "method": "eth_estimateUserOperationGas",
  "params": [
            {
            sender, // address
            nonce, // uint256
            initCode, // string
            callData, // string
            callGasLimit, // string
            verificationGasLimit, // string
            preVerificationGas, // string
            maxFeePerGas, // string
            maxPriorityFeePerGas, // string
       signature, // string
     paymasterAndData, // string
        }, "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789"
  ]
}
```

----------------------------------------

TITLE: Estimate UserOperation Gas (eth_estimateUserOperationGas)
DESCRIPTION: Explains the `eth_estimateUserOperationGas` method, used to predict gas costs for a UserOperation. It outlines the input UserOperation and EntryPoint, and the estimated gas values returned, along with a JSON-RPC request example.

SOURCE: https://docs.cloud.coinbase.com/paymaster/reference-troubleshooting/json-rpc-reference

LANGUAGE: APIDOC
CODE:
```
Method: eth_estimateUserOperationGas
Description: This endpoint will estimate the gas values for a UserOperation. The signature field is ignored and can be a dummy value, but is recommended to be of the same size as an actual signature for an accurate estimate.
Parameters:
  - UserOperation: [UserOperation](https://www.erc4337.io/docs/understanding-ERC-4337/user-operation) (Required) - The UserOperation. You can use a dummy signature but the signature must be the correct size for an accurate gas estimate.
  - entryPoint: string (Required) - EntryPoint address that the UserOperation is intended for.
Returns:
  - preVerificationGas: Amount of gas to compensate the bundler for pre-verification execution and calldata
  - verificationGasLimit: Amount of gas to allocate for the verification step
  - callGasLimit: Amount of gas to allocate the main execution call
```

LANGUAGE: JSON
CODE:
```
{
  "jsonrpc": "2.0",
   "id": 1,
  "method": "eth_estimateUserOperationGas",
  "params": [
            {
            sender, // address
            nonce, // uint256
            initCode, // string
            callData, // string
            callGasLimit, // string
            verificationGasLimit, // string
            preVerificationGas, // string
            maxFeePerGas, // string
            maxPriorityFeePerGas, // string
       signature, // string
         paymasterAndData, // string
            }, "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789"
  ]
}
```

----------------------------------------

TITLE: Paymaster Gas Policy Error Messages
DESCRIPTION: Specific error messages returned when a UserOperation is rejected due to violations of configured Paymaster gas policies. These messages help identify issues related to spending limits, transaction counts, or contract allowlist restrictions.

SOURCE: https://docs.cloud.coinbase.com/paymaster/reference-troubleshooting/errors

LANGUAGE: APIDOC
CODE:
```
Message: rejected due to max per user op spend limit exceeded
  Description: UserOperation cost too large - configure Per UserOperation limit.

Message: rejected due to max monthly org spend limit
  Description: over max monthly spend - contact us to increase your limit.

Message: rejected due to max global usd spend limit reached
  Description: over configured max total USD - adjust your policy.

Message: rejected due to maximum per address transaction count reached
  Description: per sender address maximum number of txn sponsored reached.

Message: rejected due to maximum per address sponsorship reached
  Description: per sender address maximum USD sponsorship reached.

Message: attestation not found for address
  Description: sender address does not have required attestation.

Message: target address not in allowed contracts
  Description: contract allowlist - invalid address called.

Message: method not in allowed methods
  Description: contract allowlist - wrong method called on allowed contract.
```

----------------------------------------

TITLE: Call eth_gasPrice JSON-RPC Method
DESCRIPTION: Retrieves the current estimated gas price in Wei. This value can be used to set the `gasPrice` field for transactions, helping to ensure timely processing.

SOURCE: https://docs.cloud.coinbase.com/api-reference/json-rpc-api/core

LANGUAGE: Shell
CODE:
```
curl -s {Your_Endpoint_URL} -H "Content-Type: application/json" -d '{"jsonrpc": "2.0", "id": 1, "method": "eth_gasPrice"}'
```

----------------------------------------

TITLE: Create and Execute Swap with Smart Account (quote_swap)
DESCRIPTION: Shows how to use `smart_account.quote_swap` to create and execute a swap for a smart account. This involves an owner account for signing and handles user operations, with optional gas sponsorship, providing advanced account abstraction features.

SOURCE: https://docs.cloud.coinbase.com/sdks/cdp-sdks-v2/python

LANGUAGE: python
CODE:
```
# Create or retrieve a smart account with funds already in it
owner = await cdp.evm.get_or_create_account(name="MyOwnerAccount")
smart_account = await cdp.evm.get_or_create_smart_account(name="MyExistingFundedSmartAccount", owner=owner)

# Step 1: Create a swap quote with full transaction details for smart account
swap_quote = await smart_account.quote_swap(
    from_token="0x4200000000000000000000000000000000000006",  # WETH
    to_token="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",  # USDC
    from_amount="1000000000000000000",  # 1 WETH (18 decimals)
    network="base",
    slippage_bps=100,  # 1% slippage tolerance
    # Optional: paymaster_url="https://paymaster.example.com"  # For gas sponsorship
)

# Step 2: Check if liquidity is available, and/or perform other analysis on the swap quote
if not swap_quote.liquidity_available:
    print("Insufficient liquidity for swap")
else:
    # Step 3: Execute using the quote
    result = await swap_quote.execute()
    print(f"User operation hash: {result.user_op_hash}")

    # Wait for the user operation to complete
    receipt = await smart_account.wait_for_user_operation(user_op_hash=result.user_op_hash)
    print(f"Status: {receipt.status}")
```

----------------------------------------

TITLE: Send EVM Transaction with CDP SDK (Managed Nonce/Gas)
DESCRIPTION: Demonstrates sending an EVM transaction on a Base Sepolia network using the Coinbase CDP SDK, where the SDK automatically manages transaction nonce and gas parameters. It creates an account, requests faucet funds, and sends a small amount of ETH to a zero address, then waits for transaction confirmation.

SOURCE: https://docs.cloud.coinbase.com/sdks/cdp-sdks-v2/python

LANGUAGE: python
CODE:
```
import asyncio

from dotenv import load_dotenv
from web3 import Web3

from cdp import CdpClient
from cdp.evm_transaction_types import TransactionRequestEIP1559

w3 = Web3(Web3.HTTPProvider("https://sepolia.base.org"))

async def main():
    load_dotenv()

    async with CdpClient() as cdp:
        evm_account = await cdp.evm.create_account()

        faucet_hash = await cdp.evm.request_faucet(
            address=evm_account.address, network="base-sepolia", token="eth"
        )

        w3.eth.wait_for_transaction_receipt(faucet_hash)

        zero_address = "0x0000000000000000000000000000000000000000"

        amount_to_send = w3.to_wei(0.000001, "ether")

        tx_hash = await cdp.evm.send_transaction(
            address=evm_account.address,
            transaction=TransactionRequestEIP1559(
                to=zero_address,
                value=amount_to_send,
            ),
            network="base-sepolia",
        )

        print(f"Transaction sent! Hash: {tx_hash}")

        print("Waiting for transaction confirmation...")
        tx_receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
        print(f"Transaction confirmed in block {tx_receipt.blockNumber}")
        print(f"Transaction status: {'Success' if tx_receipt.status == 1 else 'Failed'}")

asyncio.run(main())
```

----------------------------------------

TITLE: Coinbase Paymaster Billing Calculation Formula
DESCRIPTION: This formula defines how the billing for Coinbase's Paymaster service is determined. It multiplies the actual gas used by the current ETH price in USD, and then applies a 7% markup. This calculation is based on the `UserOperationEvent` rather than the transaction receipt.

SOURCE: https://docs.cloud.coinbase.com/paymaster/need-to-knows/billing-and-credits

LANGUAGE: Formula
CODE:
```
actualGasUsed * ethPriceUsd * 1.07.
```

----------------------------------------

TITLE: Create Wallet on Base Sepolia (CDP SDK)
DESCRIPTION: Example of creating a new wallet on the Base Sepolia network using CDP cURL and the CDP Platform API. This is a POST request that includes a JSON payload specifying the network ID.

SOURCE: https://docs.cloud.coinbase.com/get-started/authentication/cdp-curl

LANGUAGE: Shell
CODE:
```
cdpcurl -k ~/Downloads/cdp_api_key.json -X POST -d '{"wallet": {"network_id": "base-sepolia"}}' 'https://api.developer.coinbase.com/platform/v1/wallets'
```

----------------------------------------

TITLE: Define Basenames Contract ABIs and Addresses for Base Mainnet
DESCRIPTION: This JavaScript snippet defines the contract addresses for the Basenames Registrar Controller and L2 Resolver on Base Mainnet. It includes the relevant ABIs for the L2 Resolver (setAddr, setName functions) and the Basenames Registrar Controller (register function), along with a regular expression for Basename validation.

SOURCE: https://docs.cloud.coinbase.com/get-started/demo-apps/app-examples/basename-registration

LANGUAGE: JavaScript
CODE:
```
// Base Mainnet Registrar Controller Contract Address.
const BaseNamesRegistrarControllerAddress = "0x4cCb0BB02FCABA27e82a56646E81d8c5bC4119a5";

// Base Mainnet L2 Resolver Contract Address.
const L2ResolverAddress = "0xC6d566A56A1aFf6508b41f6c90ff131615583BCD";

// The regular expression to validate a Basename on Base Mainnet.
const baseNameRegex = /\.base\.eth$/;

// Relevant ABI for L2 Resolver Contract.
const l2ResolverABI = [
  {
    inputs: [
      { internalType: "bytes32", name: "node", type: "bytes32" },
      { internalType: "address", name: "a", type: "address" },
    ],
    name: "setAddr",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "bytes32", name: "node", type: "bytes32" },
      { internalType: "string", name: "newName", type: "string" },
    ],
    name: "setName",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
];

// Relevant ABI for Basenames Registrar Controller Contract.
const registrarABI = [
  {
    inputs: [
      {
        components: [
          {
            internalType: "string",
            name: "name",
            type: "string",
          },
          {
            internalType: "address",
            name: "owner",
            type: "address",
          },
          {
            internalType: "uint256",
            name: "duration",
            type: "uint256",
          },
          {
            internalType: "address",
            name: "resolver",
            type: "address",
          },
          {
            internalType: "bytes[]",
            name: "data",
            type: "bytes[]",
          },
          {
            internalType: "bool",
            name: "reverseRecord",
            type: "bool",
          }
        ],
        internalType: "struct RegistrarController.RegisterRequest",
        name: "request",
        type: "tuple",
      },
    ],
    name: "register",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
];
```

----------------------------------------

TITLE: Sample UserOperation JSON for Gas Estimation Debugging
DESCRIPTION: An example JSON structure representing a UserOperation, intended for use when simulating gas estimation issues with the Entrypoint contract (0x5ff137d4b0fdcd49dca30c7cf57e578a026d2789). This object should be pasted into the `tuple` field of the simulation tool. Key fields include `callData`, `paymasterAndData`, `sender`, `maxFeePerGas`, `maxPriorityFeePerGas`, `nonce`, `signature`, and gas limits.

SOURCE: https://docs.cloud.coinbase.com/paymaster/reference-troubleshooting/troubleshooting

LANGUAGE: JSON
CODE:
```
{
  "callData": "0xb61d27f600000000000000000000000066519fcaee1ed65bc9e0acc25ccd900668d3ed490000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000443f84ac0e0000000000000000000000001e3143e0ed8c0ea51f1551b6c355e02f3e0baae0000000000000000000000000000000000000000000000000000000000000006400000000000000000000000000000000000000000000000000000000",
  "paymasterAndData": "0xc484bcd10ab8ad132843872deb1a0adc1473189c000066cd03db0000000000000098973f00000a968163f0a57b400000018633de6cf5e53752c5eac49e8f8ffb4ecd16b2afe7b4074086d6693536a9ab1f117bae0b427f83f94246c34d25add97b05e8a73859c2dceef6ee730ab2842bf31b",
  "sender": "0x1e3143E0ED8C0Ea51F1551B6c355e02f3e0bAae0",
  "initCode": "0x",
  "maxFeePerGas": "3000000000",
  "maxPriorityFeePerGas": "1000000000",
  "nonce": "31815307923431762811356398485504",
  "signature": "0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000041ca7a742cff01aa9d5e377c5a146b5d8f03a4e44bd1817b1899bf7e0ff6885ed63294c69f017fe47f385c046055cc687e503bba08513ff52fbf21dcd8019c1f1d1b00000000000000000000000000000000000000000000000000000000000000",
  "callGasLimit": "257565",
  "preVerificationGas": "96024",
  "verificationGasLimit": "87888"
}
```

----------------------------------------

TITLE: Troubleshooting Global USD Spend Limit Error
DESCRIPTION: This JSON snippet illustrates the error message received when the global sponsored gas limit is reached, indicating that the overall USD spend limit for sponsored transactions has been exceeded on the Coinbase Developer Platform.

SOURCE: https://docs.cloud.coinbase.com/paymaster/guides/paymaster-masterclass

LANGUAGE: json
CODE:
```
{
  "code": -32001,
  "message": "request denied - rejected due to max global usd spend limit reached"
}
```

----------------------------------------

TITLE: Configure OnchainKitProvider for Paymaster
DESCRIPTION: This snippet shows how to modify the `OnchainKitProvider` configuration in `/src/components/OnchainProviders.tsx` to include a paymaster URL, enabling transaction sponsorship.

SOURCE: https://docs.cloud.coinbase.com/paymaster/introduction/quickstart

LANGUAGE: tsx
CODE:
```
<OnchainKitProvider
    apiKey={NEXT_PUBLIC_CDP_API_KEY}
    chain={baseSepolia}
    config={{ paymaster: process.env.NEXT_PUBLIC_PAYMASTER_AND_BUNDLER_ENDPOINT }}
    >
   {children}
 </OnchainKitProvider>
```

----------------------------------------

TITLE: Create Gasless USDC Transfer with Coinbase SDK
DESCRIPTION: This snippet demonstrates how to create a gasless USDC transfer on Base Mainnet using the Coinbase SDK. It initializes a wallet, sets the `gasless` flag to true, and includes error handling for transfer creation and waiting for on-chain completion.

SOURCE: https://docs.cloud.coinbase.com/wallet-api/v1/concepts/transfers

LANGUAGE: Typescript
CODE:
```
      import { Wallet, TimeoutError } from '@coinbase/coinbase-sdk';

      // Create a wallet on Base Mainnet
      let wallet = await Wallet.create({ networkId: Coinbase.networks.BaseMainnet });

      // Out-of-Band: Fund the wallet's default address with USDC

      // Create a gasless USDC transfer on Base Mainnet
      try {
        const transfer = await wallet.createTransfer({
          amount: 0.00001,
          assetId: Coinbase.assets.Usdc,
          destination: anotherWallet,
          gasless: true
        });
      } catch (error) {
        console.error(`Error while transferring: `, error);
      }

      // Wait for transfer to land on-chain.
      try {
        await transfer.wait();
      } catch (err) {
        if (err instanceof TimeoutError) {
          console.log("Waiting for transfer timed out");
        } else {
          console.error("Error while waiting for transfer to complete: ", error);
        }
      }

      // Check if transfer successfully completed on-chain
      if (transfer.getStatus() === 'complete') {
        console.log('Transfer completed on-chain: ', transfer.toString());
      } else {
        console.error('Transfer failed on-chain: ', transfer.toString());
      }
```

----------------------------------------

TITLE: Transfer Tokens with Smart Account and Custom Paymaster
DESCRIPTION: Explains how to use a custom paymaster URL when initiating a token transfer with a CDP SDK Smart Account. This allows for sponsored transactions where gas fees are paid by the specified paymaster.

SOURCE: https://docs.cloud.coinbase.com/sdks/cdp-sdks-v2/python

LANGUAGE: python
CODE:
```
transfer_result = await sender.transfer(
    to="0x9F663335Cd6Ad02a37B633602E98866CF944124d",
    amount="0.01",
    token="usdc",
    network="base-sepolia",
    paymaster_url="https://some-paymaster-url.com",
)
```

----------------------------------------

TITLE: Define Basename Registration Constants
DESCRIPTION: Initializes constants required for Basename registration, including the L2 Resolver contract address and a regular expression for validating Basename formats on Base Sepolia.

SOURCE: https://docs.cloud.coinbase.com/get-started/demo-apps/app-examples/basename-registration

LANGUAGE: javascript
CODE:
```
const L2ResolverAddress = "0x6533C94869D28fAA8dF77cc63f9e2b2D6Cf77eBA";

// The regular expression to validate a Basename on Base Sepolia.
const baseNameRegex = /\.basetest\.eth$/;
```

----------------------------------------

TITLE: Wait for Base Sepolia Transaction Confirmation (viem)
DESCRIPTION: This snippet demonstrates how to wait for a transaction receipt on the Base Sepolia network using `viem`'s `createPublicClient` and `waitForTransactionReceipt` function. It ensures the transaction has been confirmed on-chain.

SOURCE: https://docs.cloud.coinbase.com/payments/send-and-receive

LANGUAGE: TypeScript
CODE:
```
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";

const publicClient = createPublicClient({
chain: baseSepolia,
transport: http(),
});

const receipt = await publicClient.waitForTransactionReceipt({
hash: transactionHash,
});
```

----------------------------------------

TITLE: Import Modules for Wagmi/Viem PlayButton Component
DESCRIPTION: This code imports necessary modules for building a React component that interacts with a smart contract using Wagmi and Viem. It includes hooks for account management (`useAccount`, `useSwitchChain`), React state management (`useState`), the custom `GuessGameABI`, chain constants (`base`), Viem utilities (`parseEther`, `encodeFunctionData`), and Wagmi's experimental `useSendCalls` for sponsored transactions.

SOURCE: https://docs.cloud.coinbase.com/paymaster/guides/build-sponsored-transaction-component

LANGUAGE: TypeScript
CODE:
```
import { useAccount, useSwitchChain } from 'wagmi';
import { useState } from 'react';
import { GuessGameABI } from '../utils/abis/GuessGameABI';
import { base } from 'viem/chains';
import { parseEther, encodeFunctionData } from 'viem';
import { useSendCalls } from 'wagmi/experimental';
import {
  GUESS_GAME_ADDRESS,
  PAYMASTER_URL,
  PLAY_FEE,
} from '../utils/constants';
```

----------------------------------------

TITLE: Send EVM User Operation with CDP SDK (TypeScript)
DESCRIPTION: This TypeScript code demonstrates how to initialize the Coinbase Developer Platform (CDP) SDK, create a smart account, and send a user operation on the Base Sepolia network. It includes an example of specifying a paymaster URL for mainnet transactions, showing how to interact with EVM chains using CDP.

SOURCE: https://docs.cloud.coinbase.com/wallet-api/v2/evm-features/gas-sponsorship

LANGUAGE: typescript
CODE:
```
    import dotenv from "dotenv";
    import { parseEther } from "viem";
    import { CdpClient } from "@coinbase/cdp-sdk";
    dotenv.config();

    const cdp = new CdpClient({
        apiKeyId: process.env.CDP_API_KEY_ID,
        apiKeySecret: process.env.CDP_API_KEY_SECRET,
        walletSecret: process.env.CDP_WALLET_SECRET,
      });

    const account = await cdp.evm.createAccount();

    const smartAccount = await cdp.evm.createSmartAccount({
      owner: account,
    });

    const userOperation = await cdp.evm.sendUserOperation({
      smartAccount: smartAccount,
      network: "base-sepolia",
      calls: [
        {
          to: "0x0000000000000000000000000000000000000000",
          value: parseEther("0"),
          data: "0x"
        }
      ],
      paymasterUrl: "https://some-paymaster-url.com"
    });

    console.log("User Operation Result:", userOperation);
```