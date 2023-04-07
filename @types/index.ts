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

export interface AssetFile {
  src: string
  mediaType: string
  name: string
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
  files: AssetFile[]
  attributes: {
    [key: string]: any
  }
  serialNumber?: number
}

export interface Pool {
  poolId: string
  ticker: string
}
