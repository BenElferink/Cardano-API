import type { NextApiRequest, NextApiResponse } from 'next'
import blockfrost from '@/utils/blockfrost'
import CardanoTokenRegistry from '@/utils/cardanoTokenRegistry'
import { fromHexToString } from '@/functions/formatters/hex'
import formatIpfsReference from '@/functions/formatters/ipfsReference'
import type { PopulatedAsset } from '@/@types'

export interface AssetResponse extends PopulatedAsset {}

const handler = async (req: NextApiRequest, res: NextApiResponse<AssetResponse>) => {
  const { method, query } = req

  const assetId = query.asset_id?.toString()

  if (!assetId) {
    return res.status(400).end()
  }

  try {
    switch (method) {
      case 'GET': {
        console.log('Fetching asset:', assetId)

        const {
          policy_id: policyId,
          fingerprint,
          asset_name,
          quantity,
          onchain_metadata_standard,
          onchain_metadata,
          metadata,
        } = await blockfrost.assetsById(assetId)

        const assetName = fromHexToString(asset_name || '')
        console.log('Fetched asset:', assetName || fingerprint)

        const thumb = onchain_metadata?.image?.toString() || ''
        const image =
          thumb.indexOf('data:') !== -1
            ? {
                ipfs: '',
                url: thumb,
              }
            : formatIpfsReference(thumb.replaceAll(',', ''))

        let attributes: PopulatedAsset['attributes'] = {}
        if (onchain_metadata) {
          const ignoreKeys = ['name', 'project', 'collection', 'description', 'image', 'mediaType', 'files']
          let meta = {}

          if (onchain_metadata?.attributes) {
            meta = onchain_metadata?.attributes
          } else {
            meta = onchain_metadata
          }

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
        }
        // else if (metadata) {
        //   const ignoreKeys = ['name', 'ticker', 'description', 'logo', 'url', 'decimals']
        //   Object.entries(metadata).forEach(([key, val]) => {
        //     if (!ignoreKeys.includes(key)) {
        //       attributes[key] = val as string
        //     }
        //   })
        // }

        const payload: PopulatedAsset = {
          fingerprint,
          assetId,
          policyId,
          name: {
            onChain: assetName,
            display: (onchain_metadata?.name as string) || '',
          },
          image,
          files: (onchain_metadata?.files as PopulatedAsset['files']) || [],
          attributes,
          amount: Number(quantity),
          decimals: 0,
        }

        if (payload.amount > 1) {
          let val: number | null = null

          if (metadata && metadata.decimals != null) {
            val = metadata.decimals
          }
          if (val == null) {
            const cardanoTokenRegistry = new CardanoTokenRegistry()
            const { decimals } = await cardanoTokenRegistry.getTokenInformation(assetId)
            val = decimals
          }

          payload.decimals = val
        }

        const serialNumber = Number(assetName.match(/\d+/g)?.join(''))
        if (serialNumber) {
          payload.serialNumber = serialNumber
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
