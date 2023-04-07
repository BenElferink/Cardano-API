import { NextApiRequest, NextApiResponse } from 'next'
import blockfrost from '../../../../utils/blockfrost'

export interface PoolResponse {
  poolId: string
  ticker: string
}

const handler = async (req: NextApiRequest, res: NextApiResponse<PoolResponse>) => {
  const { method, query } = req

  const poolId = query.pool_id?.toString()

  if (!poolId) {
    return res.status(400).end('Please provide a valid Stake Pool ID')
  }

  try {
    switch (method) {
      case 'GET': {
        console.log('Fetching stake pool:', poolId)

        const data = await blockfrost.poolMetadata(poolId)
        const ticker = data.ticker || ''

        console.log('Fetched stake pool:', ticker)

        return res.status(200).json({
          poolId,
          ticker,
        })
      }

      default: {
        res.setHeader('Allow', 'GET')
        return res.status(405).end()
      }
    }
  } catch (error: any) {
    console.error(error)

    if (error?.message === 'Invalid or malformed pool id format.') {
      return res.status(404).end(`Stake Pool not found: ${poolId}`)
    }

    return res.status(500).end()
  }
}

export default handler
