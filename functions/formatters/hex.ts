export const fromHexToString = (hex: string) => {
  return decodeURIComponent('%' + hex.match(/.{1,2}/g)?.join('%'))
}

export const fromStringToHex = (txt: string) => {
  const str = String(txt)
  let result = ''

  for (let i = 0; i < str.length; i++) {
    result += str.charCodeAt(i).toString(16)
  }

  return result
}
