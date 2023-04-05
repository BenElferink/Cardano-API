import blockfrost from '@/utils/blockfrost'
import { fromStringToHex } from '../formatters/hex'

const ADA_HANDLE_POLICY_ID = 'f0ff48bbb7bbe9d59a40f1ce90e9e9d0ff5002ec48f232b49ca0fb9a'

export const resolveAddressFromHandle = async (adaHandle: string): Promise<string> => {
  const assetId = `${ADA_HANDLE_POLICY_ID}${fromStringToHex(adaHandle.replace('$', ''))}`

  const data = await blockfrost.assetsAddresses(assetId)
  const walletAddress = data[0]?.address || ''

  return walletAddress
}
