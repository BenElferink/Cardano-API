import { NextApiRequest, NextApiResponse } from 'next'
import * as cardanoSerialization from '@emurgo/cardano-serialization-lib-nodejs'
import blockfrost from '@/utils/blockfrost'
// import { components } from '@blockfrost/openapi'
import { resolveAddressFromHandle } from '@/functions/resolvers/adaHandle'

const getWalletStakeKeyAndAddressesFromCborString = async (
  walletIdentifier: string
): Promise<{
  stakeKey: string
  addresses: string[]
} | null> => {
  let stringFromCbor = ''

  try {
    stringFromCbor = cardanoSerialization.Address.from_bytes(
      walletIdentifier.length % 2 === 0 && /^[0-9A-F]*$/i.test(walletIdentifier)
        ? Buffer.from(walletIdentifier, 'hex')
        : Buffer.from(walletIdentifier, 'utf-8')
    ).to_bech32()
  } catch (error) {
    return null
  }

  let stakeKey = stringFromCbor.indexOf('stake1') === 0 ? stringFromCbor : ''
  let walletAddress = stringFromCbor.indexOf('addr1') === 0 ? stringFromCbor : ''

  if (!stakeKey && !walletAddress) {
    return null
  }

  if (!stakeKey) {
    const data = await blockfrost.addresses(walletAddress)
    stakeKey = data?.stake_address || ''
  }

  const addresses = (await blockfrost.accountsAddressesAll(stakeKey)).map((obj) => obj.address)

  return {
    stakeKey,
    addresses,
  }
}

const getWalletStakeKeyAndAddresses = async (
  walletIdentifier: string
): Promise<{
  stakeKey: string
  addresses: string[]
}> => {
  let stakeKey = walletIdentifier.indexOf('stake1') === 0 ? walletIdentifier : ''
  let walletAddress = walletIdentifier.indexOf('addr1') === 0 ? walletIdentifier : ''
  const adaHandle = walletIdentifier.indexOf('$') === 0 ? walletIdentifier : ''

  if (!stakeKey && !walletAddress && !adaHandle) {
    const result = await getWalletStakeKeyAndAddressesFromCborString(walletIdentifier)

    if (!result) {
      throw new Error('Invalid wallet identifer')
    }

    return result
  }

  if (!stakeKey) {
    if (!walletAddress) {
      walletAddress = await resolveAddressFromHandle(adaHandle)
    }

    const data = await blockfrost.addresses(walletAddress)
    stakeKey = data?.stake_address || ''
  }

  const addresses = (await blockfrost.accountsAddressesAll(stakeKey)).map((obj) => obj.address)

  return {
    stakeKey,
    addresses,
  }
}

export interface WalletResponse {
  stakeKey: string
  addresses: string[]
  poolId?: string
  assets?: {
    assetId: string
    count: number
  }[]
  // | components['schemas']['asset'][]
}

const handler = async (req: NextApiRequest, res: NextApiResponse<WalletResponse>) => {
  const { method, query } = req

  const identifier = query.wallet_identifier?.toString() as string

  // const populateAddresses = !!query.populate_addresses && query.populate_addresses == 'true'
  const withStakePool = !!query.with_stake_pool && query.with_stake_pool == 'true'
  const withAssets = !!query.with_assets && query.with_assets == 'true'
  // const populateAssets = !!query.populate_assets && query.populate_assets == 'true'
  const filterAssetsWithPolicyIds =
    !!query.filter_assets_with_policy_ids && !Array.isArray(query.filter_assets_with_policy_ids)
      ? JSON.parse(query.filter_assets_with_policy_ids)
      : false

  try {
    switch (method) {
      case 'GET': {
        const wallet = await getWalletStakeKeyAndAddresses(identifier)

        let payload: WalletResponse = {
          ...wallet,
        }

        if (withStakePool) {
          const account = await blockfrost.accounts(wallet.stakeKey)
          const poolId = account.pool_id || ''
          payload.poolId = poolId
        }

        if (withAssets) {
          const assets = await blockfrost.accountsAddressesAssetsAll(wallet.stakeKey)
          payload.assets = assets.map((obj) => ({ assetId: obj.unit, count: Number(obj.quantity) }))

          if (Array.isArray(filterAssetsWithPolicyIds) && filterAssetsWithPolicyIds.length) {
            payload.assets = payload.assets.filter((obj) => {
              let isOk = false

              filterAssetsWithPolicyIds.forEach((item: string) => {
                if (obj.assetId.indexOf(item) === 0) {
                  isOk = true
                }
              })

              return isOk
            })
          }

          // if (populateAssets) {
          //   const populateAssets: components['schemas']['asset'][] = []

          //   for await (const { assetId } of payload.assets) {
          //     const asset = await blockfrost.assetsById(assetId)
          //     const defaultKeys = [
          //       // 'project',
          //       // 'collection',
          //       // 'artist',
          //       'name',
          //       'description',
          //       'image',
          //       'mediaType',
          //       'files',
          //       // 'twitter',
          //       // 'discord',
          //       // 'website',
          //     ]

          //     // @ts-ignore
          //     if (asset.onchain_metadata_standard === 'CIP68v1') {
          //       Object.entries(asset.onchain_metadata || {}).forEach(([key, val]) => {
          //         if (!defaultKeys.includes(key.toLowerCase())) {
          //           // @ts-ignore
          //           asset.onchain_metadata[key] = fromHex(val as string).slice(1)
          //         }
          //       })
          //     }

          //     populateAssets.push(asset)
          //   }

          //   payload.assets = populateAssets
          // }
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

    if (error?.message === 'Invalid wallet identifer') {
      return res.status(400).end('Please provide a valid wallet identifer: $handle / addr1... / stake1...')
    }

    if (error?.status_code === 400 || error?.message === 'The requested component has not been found.') {
      return res.status(400).end(`Wallet not found: ${identifier}`)
    }

    return res.status(500).end()
  }
}

export default handler
