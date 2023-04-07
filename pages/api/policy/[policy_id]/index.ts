import type { NextApiRequest, NextApiResponse } from 'next'
import blockfrost from '@/utils/blockfrost'
import CnftTools from '@/utils/cnftTools'
import CardanoTokenRegistry from '@/utils/cardanoTokenRegistry'
import type { Asset } from '@/@types'
import type { RankedPolicyAsset } from '@/utils/cnftTools'

export interface PolicyResponse {
  policyId: string
  assets: Asset[]
}

const handler = async (req: NextApiRequest, res: NextApiResponse<PolicyResponse>) => {
  const { method, query } = req

  const policyId = query.policy_id?.toString()
  const withRanks = !!query.with_ranks && query.with_ranks == 'true'

  if (!policyId) {
    return res.status(400).end()
  }

  try {
    switch (method) {
      case 'GET': {
        const rankedAssets: RankedPolicyAsset[] = []

        if (withRanks) {
          const cnftTools = new CnftTools()
          const fetched = await cnftTools.getPolicyAssets(policyId)
          if (!fetched) {
            return res.status(400).end(`Policy ID does not have ranks on cnft.tools: ${policyId}`)
          }
          rankedAssets.push(...fetched)
        }

        console.log('Fetching assets:', policyId)

        const policyAssets = await blockfrost.assetsPolicyByIdAll(policyId)

        console.log('Fetched assets:', policyAssets.length)

        const assets = []

        for await (const item of policyAssets) {
          const assetId = item.asset
          const amount = Number(item.quantity)
          let decimals = 0

          if (amount > 0) {
            if (amount > 1) {
              const cardanoTokenRegistry = new CardanoTokenRegistry()
              const token = await cardanoTokenRegistry.getTokenInformation(assetId)
              decimals = token.decimals
            }

            const token: Asset = {
              assetId,
              amount,
              decimals,
            }

            if (rankedAssets.length) {
              token.rarityRank = rankedAssets.find((ranked) => ranked.assetId === assetId)?.rank || 0
            }

            assets.push(token)
          }
        }

        return res.status(200).json({
          policyId,
          assets,
        })
      }

      default: {
        res.setHeader('Allow', 'GET')
        return res.status(405).end()
      }
    }
  } catch (error: any) {
    console.error(error)

    if (error?.message === 'Invalid or malformed policy format.') {
      return res.status(400).end(`${error.message} ${policyId}`)
    }

    return res.status(500).end()
  }
}

export default handler
