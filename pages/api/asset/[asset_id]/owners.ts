import type { NextApiRequest, NextApiResponse } from 'next'
import blockfrost from '@/utils/blockfrost'
import type { Address } from '@/@types'

interface Owner extends Address {
  quantity: number
  stakeKey: string
}

export interface AssetOwnersResponse {
  assetId: string
  page: number
  owners: Owner[]
}

const handler = async (req: NextApiRequest, res: NextApiResponse<AssetOwnersResponse>) => {
  const { method, query } = req

  const assetId = query.asset_id?.toString()
  const page = Number(query.page || 1)

  if (!assetId) {
    return res.status(400).end()
  }

  try {
    switch (method) {
      case 'GET': {
        console.log('Fetching addresses:', assetId)

        const assetAddresses = await blockfrost.assetsAddresses(assetId, {
          count: 100,
          page,
          order: 'asc',
        })

        console.log('Fetched addresses:', assetAddresses.length)

        const payload: Owner[] = []

        for await (const { address, quantity } of assetAddresses) {
          console.log('Fetching wallet:', address)

          const wallet = await blockfrost.addresses(address)
          const stakeKey = wallet.stake_address || ''

          console.log('Fetched wallet:', stakeKey)

          payload.push({
            quantity: Number(quantity),
            stakeKey,
            address: wallet.address,
            isScript: wallet.script,
          })
        }

        return res.status(200).json({
          assetId,
          page,
          owners: payload,
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
