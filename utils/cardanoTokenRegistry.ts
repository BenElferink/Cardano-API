import axios from 'axios'

interface FetchedTokenMetadataValueObject {
  signatures: {
    publicKey: string
    signature: string
  }[]
  sequenceNumber: number
  value: any
}

interface FetchedTokenMetadata {
  subject: string // policyId + toHex(assetOnChainName)
  policy: string
  url?: FetchedTokenMetadataValueObject
  decimals?: FetchedTokenMetadataValueObject
  ticker?: FetchedTokenMetadataValueObject
  name?: FetchedTokenMetadataValueObject
  logo?: FetchedTokenMetadataValueObject
  description?: FetchedTokenMetadataValueObject
}

export interface TokenMetadata {
  ticker: string
  decimals: number
}

class CardanoTokenRegistry {
  baseUrl: string

  constructor() {
    this.baseUrl = 'https://tokens.cardano.org'
  }

  getTokenInformation = (assetId: string): Promise<TokenMetadata> => {
    const uri = `${this.baseUrl}/metadata/${assetId}`

    return new Promise(async (resolve, reject) => {
      try {
        console.log('Fetching token metadata:', assetId)

        const { data } = await axios.get<FetchedTokenMetadata>(uri, {
          headers: {
            'Accept-Encoding': 'application/json',
          },
        })

        const payload = {
          ticker: String(data.ticker?.value || ''),
          decimals: Number(data.decimals?.value || 0),
        }

        console.log('Fetched token metadata:', payload)

        return resolve(payload)
      } catch (error: any) {
        if (error?.response?.status === 404) {
          return resolve({
            ticker: '',
            decimals: 0,
          })
        }

        return reject(error)
      }
    })
  }
}

export default CardanoTokenRegistry
