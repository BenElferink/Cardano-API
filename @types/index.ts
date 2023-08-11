export type PolicyId = string
export type TokenId = string
export type PoolId = string
export type TransactionId = string
export type StakeKey = string

export type Marketplace = 'jpg.store'
export type ActivityType = 'LIST' | 'DELIST' | 'BUY' | 'SELL' | 'UPDATE'
export type ListingType = 'SINGLE' | 'BUNDLE' | 'UNKNOWN'

export interface Address {
  address: string
  isScript: boolean
}

export interface Token {
  tokenId: TokenId
  isFungible: boolean
  tokenAmount: {
    onChain: number
    decimals: number
    display: number
  }
  tokenName?: {
    onChain: string
    ticker: string
    display: string
  }
}

export interface Wallet {
  stakeKey: StakeKey
  addresses: Address[]
  poolId?: PoolId
  tokens?: Token[]
}

export interface RankedToken extends Token {
  rarityRank?: number
}

export interface PopulatedToken extends RankedToken {
  fingerprint: string
  policyId: PolicyId
  serialNumber?: number
  mintTransactionId: string
  mintBlockHeight?: number
  image: {
    ipfs: string
    url: string
  }
  files: {
    src: string
    mediaType: string
    name: string
  }[]
  attributes: {
    [key: string]: any
  }
}

export interface MarketToken {
  tokenId: string
  signingAddress?: string
  price: number
  date: Date
  marketplace: Marketplace
  activityType: ActivityType
  listingType: ListingType
  bundledTokens?: string[]
}

export interface Policy {
  policyId: PolicyId
  tokens: Token[] | RankedToken[]
}

export interface Pool {
  poolId: PoolId
  ticker: string
  delegators?: StakeKey[]
}

export interface Utxo {
  address: {
    from: string
    to: string
  }
  tokens: {
    tokenId: string
    tokenAmount: {
      onChain: number
    }
  }[]
}

export interface Transaction {
  transactionId: TransactionId
  block: string
  blockHeight: number
  utxos?: Utxo[]
}
