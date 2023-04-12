import type { NextApiRequest, NextApiResponse } from 'next'
import blockfrost from '@/utils/blockfrost'
import CnftTools from '@/utils/cnftTools'
import CardanoTokenRegistry from '@/utils/cardanoTokenRegistry'
import { fromHexToString } from '@/functions/formatters/hex'
import type { Token, Policy, RankedToken } from '@/@types'
import type { RankedAsset } from '@/utils/cnftTools'
import { fromChainToDisplay } from '@/functions/formatters/tokenAmount'

export const config = {
  api: {
    responseLimit: false,
  },
}

export interface PolicyResponse extends Policy {}

const handler = async (req: NextApiRequest, res: NextApiResponse<PolicyResponse>) => {
  const { method, query } = req

  const policyId = query.policy_id?.toString()
  const allTokens = !!query.all_tokens && query.all_tokens == 'true'
  const withRanks = !!query.with_ranks && query.with_ranks == 'true'

  if (!policyId) {
    return res.status(400).end()
  }

  try {
    switch (method) {
      case 'GET': {
        const rankedAssets: RankedAsset[] = []

        if (withRanks) {
          const cnftTools = new CnftTools()
          const fetched = await cnftTools.getRankedAssets(policyId)

          if (!fetched) {
            return res.status(400).end(`Policy ID does not have ranks on cnft.tools: ${policyId}`)
          }

          rankedAssets.push(...fetched)
        }

        console.log('Fetching tokens:', policyId)

        const fetchedTokens = allTokens
          ? await blockfrost.assetsPolicyByIdAll(policyId)
          : await blockfrost.assetsPolicyById(policyId)

        console.log('Fetched tokens:', fetchedTokens.length)

        const tokens = []

        for await (const item of fetchedTokens) {
          const tokenId = item.asset
          const tokenAmountOnChain = Number(item.quantity)
          let tokenAmountDecimals = 0

          const isFungible = tokenAmountOnChain > 1
          const tokenNameHexed = tokenId.replace(policyId, '')
          const tokenNameOnChain = tokenNameHexed.length !== tokenId.length ? fromHexToString(tokenNameHexed) : ''
          let tokenNameTicker = ''

          if (tokenAmountOnChain > 0) {
            if (isFungible) {
              const cardanoTokenRegistry = new CardanoTokenRegistry()
              const token = await cardanoTokenRegistry.getTokenInformation(tokenId)

              tokenAmountDecimals = token.decimals
              tokenNameTicker = token.ticker
            }

            const token: Token = {
              tokenId,
              isFungible,
              tokenAmount: {
                onChain: tokenAmountOnChain,
                decimals: tokenAmountDecimals,
                display: fromChainToDisplay(tokenAmountOnChain, tokenAmountDecimals),
              },
              tokenName: {
                onChain: tokenNameOnChain,
                ticker: tokenNameTicker,
                display: '',
              },
            }

            if (withRanks) {
              ;(token as RankedToken).rarityRank =
                rankedAssets.find((ranked) => ranked.assetId === tokenId)?.rank || 0
            }

            tokens.push(token)
          }
        }

        return res.status(200).json({
          policyId,
          tokens,
        })
      }

      default: {
        res.setHeader('Allow', 'GET')
        return res.status(405).end()
      }
    }
  } catch (error: any) {
    console.error(error)

    if (error?.message === 'Invalid or malformed policy format.') {
      return res.status(400).end(`${error.message} ${policyId}`)
    }

    return res.status(500).end()
  }
}

export default handler
