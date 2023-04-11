type PolicyId = string
type TokenId = string
type PoolId = string
type TransactionId = string
type StakeKey = string

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

export interface Pool {
  poolId: PoolId
  ticker: string
  delegators?: StakeKey[]
}

export interface Transaction {
  transactionId: TransactionId
  block: string
}

export interface RankedToken extends Token {
  rarityRank?: number
}

export interface PopulatedToken extends RankedToken {
  fingerprint: string
  policyId: PolicyId
  serialNumber?: number
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

export interface Policy {
  policyId: PolicyId
  tokens: Token[] | RankedToken[]
}
