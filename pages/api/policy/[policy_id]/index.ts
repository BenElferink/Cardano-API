import type { NextApiRequest, NextApiResponse } from 'next'
import blockfrost from '@/utils/blockfrost'
import cnftTools from '@/utils/cnftTools'
import { fromHexToString } from '@/functions/formatters/hex'
import { fromChainToDisplay } from '@/functions/formatters/tokenAmount'
import resolveTokenRegisteredMetadata from '@/functions/resolvers/tokenRegisteredMetadata'
import type { Token, Policy, RankedToken } from '@/@types'
import type { PolicyRanked } from '@/utils/cnftTools'

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
  const withBurned = !!query.with_burned && query.with_burned == 'true'
  const withRanks = !!query.with_ranks && query.with_ranks == 'true'

  if (!policyId) {
    return res.status(400).end()
  }

  try {
    switch (method) {
      case 'GET': {
        let rankedAssets: PolicyRanked = {}

        if (withRanks) {
          const fetched = await cnftTools.getPolicyRanks(policyId)

          if (!fetched) {
            return res.status(400).end(`Policy ID does not have ranks on cnft.tools: ${policyId}`)
          }

          rankedAssets = fetched
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
          const tokenNameOnChain = fromHexToString(tokenId.replace(policyId, ''))
          let tokenNameTicker = ''

          if (tokenAmountOnChain > 0 || withBurned) {
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
              tokenName: {
                onChain: tokenNameOnChain,
                ticker: tokenNameTicker,
                display: '',
              },
            }

            if (withRanks) {
              const tokenName = fromHexToString(tokenId.replace(policyId, ''))
              const rarityRank = Number(rankedAssets[tokenName] || 0)

              ;(token as RankedToken).rarityRank = rarityRank
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

    if (
      ['The requested component has not been found.', 'Invalid or malformed policy format.'].includes(
        error?.message
      )
    ) {
      return res.status(400).end(`${error.message} ${policyId}`)
    }

    return res.status(500).end()
  }
}

export default handler
