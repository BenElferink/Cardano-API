import axios from 'axios'

interface FetchedExternal {
  assetID: string // '1'
  assetName: string // 'on-chain name'
  name: string // 'display name'
  encodedName: string // 'hex'
  iconurl: string // 'ips:// --> only the reference, no prefix'
  rarityRank: string // '1'
  ownerStakeKey: string // 'stake1...'
  onSale: boolean

  [lowercasedTraitCategory: string]: any // eyewear: '(U) 3D Glasses'
}

export interface PolicyRanked {
  [tokentName: string]: string
}

export interface RankedToken {
  assetId: string
  rank: number
  attributes: {
    [key: string]: string
  }
}

class CnftTools {
  baseUrl: string

  constructor() {
    this.baseUrl = 'https://api.cnft.tools/api'
  }

  getPolicyRanks = (policyId: string): Promise<PolicyRanked | null> => {
    const uri = `${this.baseUrl}/rankings/${policyId}`

    return new Promise(async (resolve, reject) => {
      try {
        console.log('Fetching policy ranks:', policyId)

        const { data } = await axios.get<PolicyRanked>(uri, {
          headers: {
            'Accept-Encoding': 'application/json',
          },
        })

        console.log('Fetched policy ranks')

        return resolve(data)
      } catch (error: any) {
        if (error?.response?.data?.error === 'Policy ID not found') {
          return resolve(null)
        }

        return reject(error)
      }
    })
  }

  getTokens = (policyId: string): Promise<RankedToken[] | null> => {
    const uri = `${this.baseUrl}/external/${policyId}`

    return new Promise(async (resolve, reject) => {
      try {
        console.log('Fetching tokens from cnft.tools:', policyId)

        const { data } = await axios.get<FetchedExternal[]>(uri, {
          headers: {
            'Accept-Encoding': 'application/json',
          },
        })

        console.log('Fetched tokens from cnft.tools:', data.length)

        const excludeKeysFromAttributes = [
          'assetID',
          'assetName',
          'name',
          'encodedName',
          'iconurl',
          'rarityRank',
          'ownerStakeKey',
          'onSale',
        ]

        const payload = data
          .map((item) => {
            const attributes: Record<string, string> = {}

            Object.entries(item).forEach(([key, val]) => {
              if (!excludeKeysFromAttributes.includes(key)) {
                attributes[key] = val
              }
            })

            return {
              assetId: `${policyId}${item.encodedName}`,
              rank: Number(item.rarityRank),
              attributes,
            }
          })
          .sort((a, b) => a.rank - b.rank)

        return resolve(payload)
      } catch (error: any) {
        if (error?.response?.data?.error === 'Policy ID not found') {
          return resolve(null)
        }

        return reject(error)
      }
    })
  }
}

const cnftTools = new CnftTools()

export default cnftTools
