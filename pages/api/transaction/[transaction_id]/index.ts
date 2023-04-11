import type { NextApiRequest, NextApiResponse } from 'next'
import blockfrost from '../../../../utils/blockfrost'
import type { Transaction } from '@/@types'

export const config = {
  api: {
    responseLimit: false,
  },
}

export interface TransactionResponse extends Transaction {}

const handler = async (req: NextApiRequest, res: NextApiResponse<TransactionResponse>) => {
  const { method, query } = req

  const transactionId = query.transaction_id?.toString()

  if (!transactionId) {
    return res.status(400).end()
  }

  try {
    switch (method) {
      case 'GET': {
        console.log('Fetching TX:', transactionId)

        const tx = await blockfrost.txs(transactionId)
        const block = tx.block

        console.log('Fetched TX:', block)

        const payload = {
          transactionId,
          block,
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

    if (error?.message === 'The requested component has not been found.') {
      return res.status(404).end(`${error.message} ${transactionId}`)
    }

    return res.status(500).end()
  }
}

export default handler
