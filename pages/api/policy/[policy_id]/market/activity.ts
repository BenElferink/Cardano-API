import type { NextApiRequest, NextApiResponse } from 'next'
import JpgStore from '@/utils/jpgStore'
import type { MarketToken } from '@/@types'

const jpgStore = new JpgStore()

export interface PolicyMarketActivityResponse {
  policyId: string
  items: MarketToken[]
}

const handler = async (req: NextApiRequest, res: NextApiResponse<PolicyMarketActivityResponse>) => {
  const { method, query } = req

  const policyId = query.policy_id?.toString()

  if (!policyId) {
    return res.status(400).end()
  }

  try {
    switch (method) {
      case 'GET': {
        const recentSales = await jpgStore.getRecents(policyId, { sold: true })
        const recentListings = await jpgStore.getRecents(policyId, { sold: false })

        const payload = recentSales.concat(recentListings).sort((a, b) => b.date.getTime() - a.date.getTime())

        return res.status(200).json({
          policyId,
          items: payload,
        })
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
