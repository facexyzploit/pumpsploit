// Default Pump Trades Query
const pumpTradesQuery = {
  query: `{
    Solana {
      DEXTrades(
        limitBy: {count: 1, by: Trade_Buy_Currency_MintAddress}
        limit: {count: 8}
        orderBy: {descending: Block_Time}
        where: {Trade: {Buy: {PriceInUSD: {gt: 0.000001}, Currency: {MintAddress: {notIn: ["11111111111111111111111111111111"]}}, Price: {}}, Sell: {AmountInUSD: {gt: "9"}}, Dex: {ProtocolName: {is: "pump"}}, Market: {}}, Transaction: {Result: {Success: true}}}
      ) {
        Trade {
          Buy {
            Currency {
              Name
              Symbol
              MintAddress
              Decimals
              Fungible
              Uri
            }
            Price
            PriceInUSD
            Amount
          }
          Sell {
            Amount
            AmountInUSD
            Currency {
              Name
              Symbol
              MintAddress
              Decimals
              Fungible
              Uri
            }
          }
          Dex {
            ProtocolName
            ProtocolFamily
          }
          Market {
            MarketAddress
          }
        }
        Block {
          Time
        }
        Transaction {
          Signature
        }
      }
    }
  }`,
  variables: { }
};

// Pumpfun CrossMarket Query - Simplified to ensure compatibility
const pumpfunCrossMarketQuery = {
  query: `{
    Solana {
      DEXTrades(
        limit: {count: 8}
        orderBy: {descending: Block_Time}
        where: {Trade: {Dex: {ProtocolName: {is: "pump"}}, Buy: {Currency: {MintAddress: {notIn: ["11111111111111111111111111111111"]}}, PriceInUSD: {gt: 0.000001}}, Sell: {AmountInUSD: {gt: "10"}}}, Transaction: {Result: {Success: true}}}
      ) {
        Trade {
          Buy {
            Price
            PriceInUSD
            Amount
            Currency {
              Name
              Symbol
              MintAddress
              Decimals
              Fungible
              Uri
            }
          }
          Sell {
            Amount
            AmountInUSD
            Currency {
              Name
              Symbol
              MintAddress
              Decimals
              Fungible
              Uri
            }
          }
          Dex {
            ProtocolName
            ProtocolFamily
          }
          Market {
            MarketAddress
          }
        }
        Block {
          Time
        }
        Transaction {
          Signature
        }
      }
    }
  }`,
  variables: { }
};

// Market metrics query (unchanged)
const getTokenMetrics = (tokenAddress) => ({
  query: `
  query TokenMetrics($time_1h_ago: DateTime, $token: String, $side: String) {
    Solana {
      volume: DEXTradeByTokens(
        where: {
          Trade: {
            Currency: { MintAddress: { is: $token } }
            Side: { Currency: { MintAddress: { is: $side } } }
          }
          Block: { Time: { since: $time_1h_ago } }
        }
      ) {
        sum(of: Trade_Side_AmountInUSD)
      }
      liquidity: DEXPools(
        where: {
          Pool: {
            Market: {
              BaseCurrency: { MintAddress: { is: $token } }
              QuoteCurrency: { MintAddress: { is: $side } }
            }
          }
          Block: { Time: { till: $time_1h_ago } }
        }
        limit: { count: 1 }
        orderBy: { descending: Block_Time }
      ) {
        Pool {
          Base {
            PostAmountInUSD
          }
        }
      }
      marketcap: TokenSupplyUpdates(
        where: {
          TokenSupplyUpdate: { Currency: { MintAddress: { is: $token } } }
          Block: { Time: { till: $time_1h_ago } }
        }
        limitBy: { by: TokenSupplyUpdate_Currency_MintAddress, count: 1 }
        orderBy: { descending: Block_Time }
      ) {
        TokenSupplyUpdate {
          PostBalanceInUSD
          Currency {
            Name
            MintAddress
            Symbol
          }
        }
      }
    }
  }`,
  variables: {
    time_1h_ago: new Date(Date.now() - 3600000).toISOString(),
    token: tokenAddress,
    side: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" // USDC address
  }
});



// Pumpfun New Tokens Query - Monitor new token creation events
const pumpfunNewTokensQuery = {
  query: `subscription {
    Solana {
      TokenSupplyUpdates(
        where: {Instruction: {Program: {Address: {is: "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"}, Method: {is: "create"}}}}
      ) {
        Block{
          Time
        }
        Transaction{
          Signer
        }
        TokenSupplyUpdate {
          Amount
          Currency {
            Symbol
            ProgramAddress
            PrimarySaleHappened
            Native
            Name
            MintAddress
            MetadataAddress
            Key
            IsMutable
            Fungible
            EditionNonce
            Decimals
            Wrapped
            VerifiedCollection
            Uri
            UpdateAuthority
            TokenStandard
          }
          PostBalance
        }
      }
    }
  }`,
  variables: { }
};



// Graduated Query - Monitors DEX pools with bonding curve progress
const graduatedQuery = {
  query: `query GetDexPools($minutesAgo: Int!) {
  Solana {
    DEXPools(
      limitBy: { by: Pool_Market_BaseCurrency_MintAddress, count: 1 }
      limit: { count: 10 }
      orderBy: { ascending: Pool_Base_PostAmount }
      where: {
        Pool: {
          Base: { PostAmount: { gt: "206900000" } }
          Dex: { ProgramAddress: { is: "LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj" } }
          Market: {
            QuoteCurrency: {
              MintAddress: {
                in: ["11111111111111111111111111111111", "So11111111111111111111111111111111111111112"]
              }
            }
          }
        }
        Transaction: { Result: { Success: true } }
        Block: { Time: { since_relative: { minutes_ago: $minutesAgo } } }
      }
    ) {
      Bonding_Curve_Progress_percentage: calculate(
        expression: "((($Pool_Base_Balance - 206900000) * 100) / (793100000 - 206900000))"
      )
      Pool {
        Market {
          BaseCurrency {
            MintAddress
            Name
            Symbol
          }
          MarketAddress
          QuoteCurrency {
            MintAddress
            Name
            Symbol
          }
        }
        Dex {
          ProtocolName
          ProtocolFamily
        }
        Base {
          Balance: PostAmount(maximum: Block_Time)
        }
        Quote {
          PostAmount
          PriceInUSD
          PostAmountInUSD
        }
      }
    }
  }
}`,
  variables: {
    minutesAgo: 5
  }
};

// Monitoring More Query - Monitors DEX pools with bonding curve progress
const monitoringMoreQuery = {
  query: `{
  Solana {
    DEXPools(
      limitBy: { by: Pool_Market_BaseCurrency_MintAddress, count: 1 }
      limit: { count: 10 }
      orderBy: { ascending: Pool_Base_PostAmount }
      where: {
        Pool: {
          Base: { PostAmount: { gt: "206900000" } }
          Dex: { ProgramAddress: { is: "LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj" } }
          Market: {
            QuoteCurrency: {
              MintAddress: {
                in: ["11111111111111111111111111111111", "So11111111111111111111111111111111111111112"]
              }
            }
          }
        }
        Transaction: { Result: { Success: true } }
        Block: { Time: { since_relative: { minutes_ago: 5 } } }
      }
    ) {
      Bonding_Curve_Progress_percentage: calculate(
        expression: "((($Pool_Base_Balance - 206900000) * 100) / (793100000 - 206900000))"
      )
      Pool {
        Market {
          BaseCurrency {
            MintAddress
            Name
            Symbol
          }
          MarketAddress
          QuoteCurrency {
            MintAddress
            Name
            Symbol
          }
        }
        Dex {
          ProtocolName
          ProtocolFamily
        }
        Base {
          Balance: PostAmount(maximum: Block_Time)
        }
        Quote {
          PostAmount
          PriceInUSD
          PostAmountInUSD
        }
      }
    }
  }
}`,
  variables: { }
};

// Fallback simple query for when main queries fail
const fallbackQuery = {
  query: `{
    Solana {
      DEXTrades(
        limit: {count: 5}
        orderBy: {descending: Block_Time}
        where: {Trade: {Dex: {ProtocolName: {is: "pump"}}, Buy: {Currency: {MintAddress: {notIn: ["11111111111111111111111111111111"]}}}}, Transaction: {Result: {Success: true}}}
      ) {
        Trade {
          Buy {
            Currency {
              Name
              Symbol
              MintAddress
              Decimals
              Fungible
              Uri
            }
            Price
            PriceInUSD
            Amount
          }
          Sell {
            Amount
            AmountInUSD
          }
          Dex {
            ProtocolName
            ProtocolFamily
          }
          Market {
            MarketAddress
          }
        }
        Block {
          Time
        }
        Transaction {
          Signature
        }
      }
    }
  }`,
  variables: { }
};

// Query selection helper (optional, for legacy code)
function getQueryConfig(queryType = 'pump') {
  if (queryType === 'pumpfunCrossMarket') return pumpfunCrossMarketQuery;
  if (queryType === 'pumpfunNewTokens') return pumpfunNewTokensQuery;
  if (queryType === 'monitoringMore') return monitoringMoreQuery;
  if (queryType === 'graduated') return graduatedQuery;
  return pumpTradesQuery;
}

// Query string helper (optional, for legacy code)
function stringifyQueryConfig(queryType) {
  return JSON.stringify(getQueryConfig(queryType));
}

export {
  getQueryConfig,
  stringifyQueryConfig,
  getTokenMetrics,
  pumpfunCrossMarketQuery,
  pumpTradesQuery,
  pumpfunNewTokensQuery,
  monitoringMoreQuery,
  graduatedQuery,
  fallbackQuery
};