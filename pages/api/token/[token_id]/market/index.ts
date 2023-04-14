import type { NextApiRequest, NextApiResponse } from 'next'
import JpgStore from '@/utils/jpgStore'
import type { MarketToken } from '@/@types'

const jpgStore = new JpgStore()

export interface TokenMarketActivityResponse extends MarketToken {}

const handler = async (req: NextApiRequest, res: NextApiResponse<TokenMarketActivityResponse>) => {
  const { method, query } = req

  const tokenId = query.token_id?.toString()

  if (!tokenId) {
    return res.status(400).end()
  }

  try {
    switch (method) {
      case 'GET': {
        const payload = await jpgStore.getToken(tokenId)

        return res.status(200).json(payload)
      }

      default: {
        res.setHeader('Allow', 'GET')
        return res.status(405).end()
      }
    }
  } catch (error: any) {
    console.error(error)

    if (['Token not found'].includes(error?.response?.data?.message)) {
      return res.status(404).end(`Token not found: ${tokenId}`)
    }

    return res.status(500).end()
  }
}

export default handler
