export const fromDisplayToChain = (amount: number | string, decimals: number): number => {
  return Number(amount || 0) * Number(`1${new Array(decimals).fill(0).join('')}`)
}

export const fromChainToDisplay = (amount: number | string, decimals: number): number => {
  return Number(amount || 0) / Number(`1${new Array(decimals).fill(0).join('')}`)
}
