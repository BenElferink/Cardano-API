import type { NextApiRequest, NextApiResponse } from 'next'
import blockfrost from '@/utils/blockfrost'
import { fromChainToDisplay } from '@/functions/formatters/tokenAmount'
import resolveTokenRegisteredMetadata from '@/functions/resolvers/tokenRegisteredMetadata'
import resolveWalletIdentifiers from '@/functions/resolvers/walletIdentifiers'
import { INVALID_WALLET_IDENTIFIER } from '@/constants'
import type { Token, Wallet } from '@/@types'

export const config = {
  api: {
    responseLimit: false,
  },
}

export interface WalletResponse extends Wallet {}

const handler = async (req: NextApiRequest, res: NextApiResponse<WalletResponse>) => {
  const { method, query } = req

  const walletId = query.wallet_id?.toString() as string

  const allAddresses = !!query.all_addresses && query.all_addresses == 'true'
  const withStakePool = !!query.with_stake_pool && query.with_stake_pool == 'true'
  const withTokens = !!query.with_tokens && query.with_tokens == 'true'

  try {
    switch (method) {
      case 'GET': {
        console.log('Fetching wallet:', walletId)

        const { stakeKey, addresses } = await resolveWalletIdentifiers(walletId)

        console.log('Fetched wallet:', stakeKey)

        const populatedAddresses = []

        for (let idx = 0; idx < addresses.length; idx++) {
          const addr = addresses[idx]

          console.log('Fetching address:', addr)

          const { type, script } = await blockfrost.addresses(addr)

          console.log('Fetched address:', type)

          populatedAddresses.push({
            address: addr,
            isScript: script,
          })

          if (!allAddresses) break
        }

        let wallet: Wallet = {
          stakeKey,
          addresses: populatedAddresses,
        }

        if (withStakePool) {
          console.log('Fetching wallet stake pool:', stakeKey)

          const account = await blockfrost.accounts(stakeKey)
          const poolId = account.pool_id || ''

          console.log('Fetched wallet stake pool:', poolId)

          wallet.poolId = poolId
        }

        if (withTokens) {
          console.log('Fetching wallet tokens:', stakeKey)

          const fetchedTokens = await blockfrost.accountsAddressesAssetsAll(stakeKey)

          console.log('Fetched wallet tokens:', fetchedTokens.length)

          wallet.tokens = []

          for await (const obj of fetchedTokens) {
            const tokenId = obj.unit
            const tokenAmountOnChain = Number(obj.quantity)
            let tokenAmountDecimals = 0

            const isFungible = tokenAmountOnChain > 1
            let tokenNameTicker = ''

            if (isFungible) {
              const { decimals, ticker } = await resolveTokenRegisteredMetadata(tokenId)

              tokenAmountDecimals = decimals
              tokenNameTicker = ticker
            }

            const token: Token = {
              tokenId,
              isFungible,
              tokenAmount: {
                onChain: tokenAmountOnChain,
                decimals: tokenAmountDecimals,
                display: fromChainToDisplay(tokenAmountOnChain, tokenAmountDecimals),
              },
            }

            if (isFungible) {
              token.tokenName = {
                onChain: '',
                ticker: tokenNameTicker,
                display: '',
              }
            }

            wallet.tokens.push(token)
          }
        }

        return res.status(200).json(wallet)
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

    if (
      [
        'The requested component has not been found.',
        'Invalid address for this network or malformed address format.',
        'Invalid or malformed stake address format.',
      ].includes(error?.message)
    ) {
      return res.status(404).end(`Wallet not found: ${walletId}`)
    }

    return res.status(500).end()
  }
}

export default handler
