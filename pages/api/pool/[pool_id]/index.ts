import type { NextApiRequest, NextApiResponse } from 'next'
import blockfrost from '@/utils/blockfrost'
import type { Pool } from '@/@types'

export const config = {
  api: {
    responseLimit: false,
  },
}

export interface PoolResponse extends Pool {}

const handler = async (req: NextApiRequest, res: NextApiResponse<PoolResponse>) => {
  const { method, query } = req

  const poolId = query.pool_id?.toString()
  const withDelegators = !!query.with_delegators && query.with_delegators == 'true'

  if (!poolId) {
    return res.status(400).end()
  }

  try {
    switch (method) {
      case 'GET': {
        console.log('Fetching stake pool:', poolId)

        const data = await blockfrost.poolMetadata(poolId)
        const ticker = data.ticker || ''

        console.log('Fetched stake pool:', ticker)

        const payload: Pool = {
          poolId,
          ticker,
        }

        if (withDelegators) {
          console.log('Fetching delegators:', poolId)

          const delegators: Pool['delegators'] = []

          for (let page = 1; true; page++) {
            const count = 100
            const fetched = await blockfrost.poolsByIdDelegators(poolId, { count, page })

            delegators.push(...fetched.map((delegator) => delegator.address))
            if (!fetched.length || fetched.length < count) break
          }

          console.log('Fetched delegators:', delegators.length)

          payload.delegators = delegators
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

    if (error?.message === 'Invalid or malformed pool id format.') {
      return res.status(400).end(`${error.message} ${poolId}`)
    }

    return res.status(500).end()
  }
}

export default handler
