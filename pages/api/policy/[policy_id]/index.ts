import { NextApiRequest, NextApiResponse } from 'next'
import blockfrost from '../../../../utils/blockfrost'
import CnftTools from '@/utils/cnftTools'

export interface PolicyResponse {
  policyId: string
  assets: {
    assetId: string
    count: number
    rank?: number
    attributes?: {
      [key: string]: string
    }
  }[]
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
        if (withRanks) {
          const cnftTools = new CnftTools()
          const rankedAssets = await cnftTools.getPolicyAssets(policyId)

          if (!rankedAssets) {
            return res.status(404).end(`Policy ID does not exist on cnft.tools: ${policyId}`)
          }

          const assets = rankedAssets.map((item) => ({
            assetId: item.assetId,
            count: 1,
            rank: item.rank,
            attributes: item.attributes,
          }))

          return res.status(200).json({
            policyId,
            assets,
          })
        }

        console.log('Fetching assets:', policyId)

        const policyAssets = await blockfrost.assetsPolicyByIdAll(policyId)

        console.log('Fetched assets:', policyAssets.length)

        const assets = policyAssets.map((item) => ({
          assetId: item.asset,
          count: Number(item.quantity),
        }))
        // .filter((item) => item.count > 0)

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
      return res.status(404).end(`Policy ID not found: ${policyId}`)
    }

    return res.status(500).end()
  }
}

export default handler
