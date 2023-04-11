export interface Address {
  address: string
  isScript?: boolean
}

export interface Asset {
  assetId: string
  amount: number
  decimals: number
  rarityRank?: number
}

export interface Wallet {
  stakeKey: string
  addresses: Address[]
  poolId?: string
  assets?: Asset[]
}

export interface Policy {
  policyId: string
  assets: Asset[]
}

export interface Pool {
  poolId: string
  ticker: string
  delegators?: string[]
}

export interface Transaction {
  transactionId: string
  block: string
}

export interface PopulatedAsset extends Asset {
  fingerprint: string
  policyId: string
  name: {
    onChain: string
    display: string
  }
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
  serialNumber?: number
}
