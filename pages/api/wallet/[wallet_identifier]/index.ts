import type { NextApiRequest, NextApiResponse } from 'next'
import * as cardanoSerialization from '@emurgo/cardano-serialization-lib-nodejs'
import blockfrost from '@/utils/blockfrost'
import CardanoTokenRegistry from '@/utils/cardanoTokenRegistry'
import { resolveAddressFromHandle } from '@/functions/resolvers/adaHandle'
import type { Wallet } from '@/@types'

const INVALID_WALLET_IDENTIFIER = 'INVALID_WALLET_IDENTIFIER'

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
      throw new Error(INVALID_WALLET_IDENTIFIER)
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

export interface WalletResponse extends Wallet {}

const handler = async (req: NextApiRequest, res: NextApiResponse<WalletResponse>) => {
  const { method, query } = req

  const identifier = query.wallet_identifier?.toString() as string

  const withStakePool = !!query.with_stake_pool && query.with_stake_pool == 'true'
  const withAssets = !!query.with_assets && query.with_assets == 'true'

  try {
    switch (method) {
      case 'GET': {
        console.log('Fetching wallet:', identifier)

        const { stakeKey, addresses } = await getWalletStakeKeyAndAddresses(identifier)

        console.log('Fetched wallet:', stakeKey)

        const populateAddresses = []

        for await (const str of addresses) {
          console.log('Fetching address:', str)

          const wallet = await blockfrost.addresses(str)

          console.log('Fetched address:', wallet.type)

          populateAddresses.push({
            address: str,
            isScript: wallet.script,
          })
        }

        let payload: Wallet = {
          stakeKey,
          addresses: populateAddresses,
        }

        if (withStakePool) {
          console.log('Fetching wallet stake pool:', stakeKey)

          const account = await blockfrost.accounts(stakeKey)
          const poolId = account.pool_id || ''

          console.log('Fetched wallet stake pool:', poolId)

          payload.poolId = poolId
        }

        if (withAssets) {
          console.log('Fetching wallet assets:', stakeKey)

          const assets = await blockfrost.accountsAddressesAssetsAll(stakeKey)

          console.log('Fetched wallet assets:', assets.length)

          payload.assets = []

          for await (const obj of assets) {
            const assetId = obj.unit
            const amount = Number(obj.quantity)
            let decimals = 0

            if (amount > 1) {
              const cardanoTokenRegistry = new CardanoTokenRegistry()
              const token = await cardanoTokenRegistry.getTokenInformation(assetId)
              decimals = token.decimals
            }

            payload.assets.push({
              assetId,
              amount,
              decimals,
            })
          }
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

    if (error?.message === INVALID_WALLET_IDENTIFIER) {
      return res.status(400).end('Please provide a valid wallet identifer: $handle / addr1... / stake1...')
    }

    if (error?.message === 'The requested component has not been found.') {
      return res.status(404).end(`Wallet not found: ${identifier}`)
    }

    return res.status(500).end()
  }
}

export default handler
