import type { NextApiRequest, NextApiResponse } from 'next'
import blockfrost from '@/utils/blockfrost'
import { fromHexToString } from '@/functions/formatters/hex'
import { fromChainToDisplay } from '@/functions/formatters/tokenAmount'
import formatIpfsReference from '@/functions/formatters/ipfsReference'
import resolveTokenRegisteredMetadata from '@/functions/resolvers/tokenRegisteredMetadata'
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
  const populateMintTx = !!query.populate_mint_tx && query.populate_mint_tx == 'true'

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
          initial_mint_tx_hash,
        } = await blockfrost.assetsById(tokenId)

        console.log('Fetched token:', fingerprint)

        const tokenAmountOnChain = Number(quantity)
        let tokenAmountDecimals = 0

        const isFungible = tokenAmountOnChain > 1
        const tokenNameOnChain = fromHexToString(asset_name || tokenId.replace(policyId, ''))
        const tokenNameDisplay = onchain_metadata?.name?.toString() || metadata?.name?.toString() || ''
        let tokenNameTicker = ''

        if (isFungible) {
          const { decimals, ticker } = await resolveTokenRegisteredMetadata(tokenId, metadata)

          tokenAmountDecimals = decimals
          tokenNameTicker = ticker
        }

        const thumb = onchain_metadata?.image
          ? Array.isArray(onchain_metadata.image)
            ? onchain_metadata.image.join('')
            : onchain_metadata.image.toString()
          : metadata?.logo
          ? `data:image/png;base64,${metadata?.logo}`
          : ''

        const image =
          thumb.indexOf('data:') === 0 || thumb.indexOf('https:') === 0
            ? {
                ipfs: '',
                url: thumb,
              }
            : formatIpfsReference(thumb.replaceAll(',', ''))

        const files = (onchain_metadata?.files as PopulatedToken['files']) || []

        const meta = onchain_metadata?.attributes || onchain_metadata || metadata || {}
        const attributes: PopulatedToken['attributes'] = {}

        const ignoreKeys = ['project', 'collection', 'name', 'description', 'logo', 'image', 'mediaType', 'files', 'decimals', 'ticker', 'url']

        Object.entries(meta).forEach(([key, val]) => {
          if (!ignoreKeys.includes(key)) {
            if (onchain_metadata_standard === 'CIP68v1') {
              attributes[key] = fromHexToString(val?.toString() || 'X').slice(1)
            } else {
              attributes[key] = val?.toString()
            }
          }
        })

        const payload: PopulatedToken = {
          tokenId,
          fingerprint,
          isFungible,
          policyId,
          serialNumber: Number(tokenNameOnChain.match(/\d+/g)?.join('')) || undefined,
          mintTransactionId: initial_mint_tx_hash,
          mintBlockHeight: undefined,
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

        if (populateMintTx) {
          console.log('Fetching TX:', payload.mintTransactionId)

          const tx = await blockfrost.txs(payload.mintTransactionId)

          console.log('Fetched TX')

          payload.mintBlockHeight = tx.block_height
        } else {
          payload.mintBlockHeight = undefined
          delete payload.mintBlockHeight
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
  } catch (error: any) {
    console.error(error)

    if (['The requested component has not been found.', 'Invalid or malformed asset format.'].includes(error?.message)) {
      return res.status(404).end(`Token not found: ${tokenId}`)
    }

    return res.status(500).end()
  }
}

export default handler
