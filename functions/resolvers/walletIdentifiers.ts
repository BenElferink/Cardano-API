import blockfrost from '@/utils/blockfrost'
import * as cardanoSerialization from '@emurgo/cardano-serialization-lib-nodejs'
import { resolveAddressFromHandle } from './adaHandle'
import { INVALID_WALLET_IDENTIFIER } from '@/constants'

const resolveWalletIdentifiersFromCborString = async (
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

const resolveWalletIdentifiers = async (
  walletIdentifier: string
): Promise<{
  stakeKey: string
  addresses: string[]
}> => {
  let stakeKey = walletIdentifier.indexOf('stake1') === 0 ? walletIdentifier : ''
  let walletAddress = walletIdentifier.indexOf('addr1') === 0 ? walletIdentifier : ''
  const adaHandle = walletIdentifier.indexOf('$') === 0 ? walletIdentifier : ''

  if (!stakeKey && !walletAddress && !adaHandle) {
    const result = await resolveWalletIdentifiersFromCborString(walletIdentifier)

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

export default resolveWalletIdentifiers
