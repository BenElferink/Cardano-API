import type { NextApiRequest, NextApiResponse } from 'next'
import blockfrost from '@/utils/blockfrost'
import CardanoTokenRegistry from '@/utils/cardanoTokenRegistry'
import { fromHexToString } from '@/functions/formatters/hex'
import { fromChainToDisplay } from '@/functions/formatters/tokenAmount'
import formatIpfsReference from '@/functions/formatters/ipfsReference'
import type { PopulatedToken } from '@/@types'

export const config = {
  api: {
    responseLimit: false,
  },
}

export interface TokenResponse extends PopulatedToken {}

const handler = async (req: NextApiRequest, res: NextApiResponse<TokenResponse>) => {
  const { method, query } = req

  const tokenId = query.token_id?.toString()

  if (!tokenId) {
    return res.status(400).end()
  }

  try {
    switch (method) {
      case 'GET': {
        console.log('Fetching token:', tokenId)

        const {
          policy_id: policyId,
          fingerprint,
          asset_name,
          quantity,
          onchain_metadata_standard,
          onchain_metadata,
          metadata,
        } = await blockfrost.assetsById(tokenId)

        console.log('Fetched asset:', fingerprint)

        const tokenAmountOnChain = Number(quantity)
        let tokenAmountDecimals = 0

        const isFungible = tokenAmountOnChain > 1
        const tokenNameOnChain = fromHexToString(asset_name || tokenId.replace(policyId, ''))
        let tokenNameTicker = ''
        let tokenNameDisplay = ''

        if (isFungible) {
          let _decimals: number | null = null
          let _ticker: string | null = null

          if (metadata && metadata.decimals != null) _decimals = metadata.decimals
          if (metadata && metadata.ticker != null) _ticker = metadata.ticker

          if (_decimals == null || _ticker == null) {
            const cardanoTokenRegistry = new CardanoTokenRegistry()
            const { ticker, decimals } = await cardanoTokenRegistry.getTokenInformation(tokenId)

            _decimals = decimals
            _ticker = ticker
          }

          tokenAmountDecimals = _decimals
          tokenNameTicker = _ticker
        }

        const thumb = onchain_metadata?.image?.toString() || ''
        const image =
          thumb.indexOf('data:') !== -1
            ? {
                ipfs: '',
                url: thumb,
              }
            : formatIpfsReference(thumb.replaceAll(',', ''))

        const files = (onchain_metadata?.files as PopulatedToken['files']) || []

        const attributes: PopulatedToken['attributes'] = {}
        if (onchain_metadata) {
          tokenNameDisplay = onchain_metadata?.name?.toString() || ''

          let meta = {}
          if (onchain_metadata?.attributes) {
            meta = onchain_metadata.attributes
          } else {
            meta = onchain_metadata
          }

          const ignoreKeys = ['name', 'project', 'collection', 'description', 'image', 'mediaType', 'files']
          Object.entries(meta).forEach(([key, val]) => {
            if (!ignoreKeys.includes(key)) {
              // @ts-ignore
              if (onchain_metadata_standard === 'CIP68v1') {
                attributes[key] = fromHexToString(val as string).slice(1)
              } else {
                attributes[key] = val as string
              }
            }
          })
        } else if (metadata) {
          tokenNameDisplay = metadata?.name || ''

          // const ignoreKeys = ['name', 'ticker', 'description', 'logo', 'url', 'decimals']
          // Object.entries(metadata).forEach(([key, val]) => {
          //   if (!ignoreKeys.includes(key)) {
          //     attributes[key] = val as string
          //   }
          // })
        }

        const payload: PopulatedToken = {
          tokenId,
          fingerprint,
          policyId,
          serialNumber: Number(tokenNameOnChain.match(/\d+/g)?.join('')) || 0,
          isFungible,
          tokenAmount: {
            onChain: Number(quantity),
            decimals: tokenAmountDecimals,
            display: fromChainToDisplay(tokenAmountOnChain, tokenAmountDecimals),
          },
          tokenName: {
            onChain: tokenNameOnChain,
            ticker: tokenNameTicker,
            display: tokenNameDisplay,
          },
          image,
          files,
          attributes,
        }

        if (!payload.serialNumber) {
          payload.serialNumber = undefined
          delete payload.serialNumber
        }

        return res.status(200).json(payload)
      }

      default: {
        res.setHeader('Allow', 'GET')
        return res.status(405).end()
      }
    }
  } catch (error) {
    console.error(error)

    return res.status(500).end()
  }
}

export default handler
