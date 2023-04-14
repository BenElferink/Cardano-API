import axios from 'axios'
import { fromChainToDisplay } from '@/functions/formatters/tokenAmount'
import type { ActivityType, MarketToken, PolicyId, StakeKey, TokenId, TransactionId } from '@/@types'

interface FetchedListingOrSale {
  asset_id: TokenId
  listing_id: number | null
  display_name: string
  price_lovelace: string
  tx_hash: TransactionId
  listed_at?: string
  confirmed_at?: string
  listing_type: 'SINGLE_ASSET' | 'BUNDLE'
  bundled_assets?: {
    asset_id: string
    display_name: string
  }[]
}

interface FetchedToken {
  policy_id: PolicyId
  asset_id: TokenId
  display_name: string
  onchain_metadata: Record<string, any>
  traits: {
    [key: string]: string
    // 'attributes / Skin': '(f) huntress'
  }
  collections: {
    display_name: string
    description: string
    policy_id: PolicyId
    supply: string
    traits: {
      [key: string]: {
        [key: string]: number
      }
      // 'attributes / Skin': {
      //   '(f) huntress': 50
      // }
    }
    // and other keys we don't need
  }
  listings: {
    token_asset_id: TokenId
    listed_at: Date
    bundled_assets?: {
      asset_id: TokenId
    }[]
    active_transaction_obj: {
      tx_hash: TransactionId // with an #index at the end
      listing: 21640449
      action: ActivityType
      confirmed_at: Date
      amount_lovelace: string
      signer_address: string
      signer_stake_key: StakeKey
      // and other keys we don't need
    }
    // and other keys we don't need
  }[]
}

interface FetchedTokenActivity {
  action: ActivityType
  tx_hash: TransactionId
  seller_address: string
  signer_address: string
  confirmed_at: string
  amount_lovelace: string
  bundled_assets_count: string
}

class JpgStore {
  baseUrl: string

  constructor() {
    this.baseUrl = 'https://server.jpgstoreapis.com'
  }

  private formatListingOrSale = (activityType: ActivityType, items: FetchedListingOrSale[]): MarketToken[] => {
    return items.map(({ asset_id, price_lovelace, listing_type, bundled_assets, confirmed_at, listed_at }) => {
      const payload: MarketToken = {
        tokenId: asset_id,
        price: fromChainToDisplay(price_lovelace, 6),
        // @ts-ignore
        date: new Date(activityType === 'SELL' ? confirmed_at : listed_at),
        marketplace: 'jpg.store',
        activityType,
        listingType: listing_type === 'SINGLE_ASSET' ? 'SINGLE' : listing_type === 'BUNDLE' ? 'BUNDLE' : 'UNKNOWN',
      }

      if (payload.listingType === 'BUNDLE') {
        payload.bundledTokens = bundled_assets?.map(({ asset_id }) => asset_id) || []
      }

      return payload
    })
  }

  getListings = (policyId: string, options: { withAll?: boolean } = {}): Promise<MarketToken[]> => {
    const withAll = options.withAll ?? false
    const uri = `${this.baseUrl}/policy/${policyId}/listings`

    return new Promise(async (resolve, reject) => {
      try {
        console.log('Fetching listings', policyId)

        let cursor = null
        const fetchedItems: FetchedListingOrSale[] = []

        for (let i = 0; true; i++) {
          if (!cursor && i > 0) break

          // @ts-ignore
          const { data } = await axios.get<{ nextPageCursor: string | null; listings: FetchedListingOrSale[] }>(
            `${uri}${cursor ? `?cursor=${cursor}` : ''}`,
            {
              headers: {
                'Accept-Encoding': 'application/json',
              },
            }
          )

          if (!data.listings.length) break

          fetchedItems.push(...data.listings)
          cursor = data.nextPageCursor

          if (!withAll) break
        }

        console.log('Fetched listings', fetchedItems.length)

        const payload = this.formatListingOrSale('LIST', fetchedItems).sort((a, b) => a.price - b.price)

        return resolve(payload)
      } catch (error) {
        return reject(error)
      }
    })
  }

  getRecents = (policyId: string, options: { sold?: boolean; page?: number } = {}): Promise<MarketToken[]> => {
    const sold = options.sold ?? false
    const activityType = sold ? 'SELL' : 'LIST'

    const pathType = sold ? 'sales' : 'listings'
    const page = 1

    const uri = `${this.baseUrl}/policy/${policyId}/${pathType}${sold ? `?page=${page}` : ''}`

    return new Promise(async (resolve, reject) => {
      try {
        console.log(`Fetching recent ${pathType} at page ${page}`, policyId)

        const { data } = await axios.get<FetchedListingOrSale[]>(uri, {
          headers: {
            'Accept-Encoding': 'application/json',
          },
        })

        // @ts-ignore (data["listings"] exists only for pathType = "/listings")
        const fetchedItems = !sold ? data?.listings : data

        console.log(`Fetched recent ${pathType}`, fetchedItems.length)

        const payload = this.formatListingOrSale(activityType, fetchedItems).sort(
          (a, b) => b.date.getTime() - a.date.getTime()
        )

        return resolve(payload)
      } catch (error) {
        return reject(error)
      }
    })
  }

  getToken = (tokenId: string): Promise<MarketToken> => {
    const uri = `${this.baseUrl}/token/${tokenId}`

    return new Promise(async (resolve, reject) => {
      try {
        console.log('Fetching token', tokenId)

        const { data } = await axios.get<FetchedToken>(uri, {
          headers: {
            'Accept-Encoding': 'application/json',
          },
        })

        console.log('Fetched token', data.display_name)

        const listing = data.listings[0]

        if (listing) {
          const payload: MarketToken = {
            tokenId,
            signingAddress: listing.active_transaction_obj.signer_address,
            price: fromChainToDisplay(listing.active_transaction_obj.amount_lovelace, 6),
            date: new Date(listing.active_transaction_obj.confirmed_at),
            marketplace: 'jpg.store',
            activityType: listing.active_transaction_obj.action,
            listingType: listing.bundled_assets?.length ? 'BUNDLE' : 'SINGLE',
          }

          if (payload.listingType === 'BUNDLE') {
            payload.bundledTokens = listing.bundled_assets?.map((item) => item.asset_id) || []
          }

          return resolve(payload)
        } else {
          const payload: MarketToken = {
            tokenId,
            price: 0,
            // @ts-ignore
            date: '',
            // @ts-ignore
            marketplace: '',
            // @ts-ignore
            activityType: '',
            // @ts-ignore
            listingType: '',
          }

          return resolve(payload)
        }
      } catch (error) {
        return reject(error)
      }
    })
  }

  getTokenActivity = (tokenId: string): Promise<MarketToken[]> => {
    const uri = `${this.baseUrl}/token/${tokenId}/tx-history?limit=50&offset=0`

    return new Promise(async (resolve, reject) => {
      try {
        console.log('Fetching token activity', tokenId)

        const { data } = await axios.get<{
          count: number
          txs: FetchedTokenActivity[]
        }>(uri, {
          headers: {
            'Accept-Encoding': 'application/json',
          },
        })

        console.log('Fetched token activity', data.txs.length)

        const payload = data.txs
          .map(({ amount_lovelace, action, bundled_assets_count, confirmed_at, signer_address }) => {
            const item: MarketToken = {
              tokenId,
              signingAddress: signer_address,
              price: fromChainToDisplay(amount_lovelace, 6),
              date: new Date(confirmed_at),
              marketplace: 'jpg.store',
              activityType: action,
              listingType: Number(bundled_assets_count) > 1 ? 'BUNDLE' : 'SINGLE',
            }

            if (item.listingType === 'BUNDLE') {
              item.bundledTokens = []
            }

            return item
          })
          .sort((a, b) => b.date.getTime() - a.date.getTime())

        return resolve(payload)
      } catch (error) {
        return reject(error)
      }
    })
  }
}

export default JpgStore
