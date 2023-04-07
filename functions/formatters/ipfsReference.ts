const formatIpfsReference = (str: string, options: { hasRank?: boolean } = {}) => {
  if (!str) {
    return {
      ipfs: '',
      url: '',
    }
  }

  const { hasRank } = options

  const ipfs = str.indexOf('ipfs://') === 0 ? str : `ipfs://${str}`
  const url = hasRank
    ? ipfs.replace('ipfs://', 'https://images.cnft.tools/ipfs/')
    : ipfs.replace('ipfs://', 'https://image-optimizer.jpgstoreapis.com/')

  return {
    ipfs,
    url,
  }
}

export default formatIpfsReference
