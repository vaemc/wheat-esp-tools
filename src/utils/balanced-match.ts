
/**
 * @param {string | RegExp} a
 * @param {string | RegExp} b
 * @param {string} str
 */
export function balanced (a:any, b:any, str:any) {
  if (a instanceof RegExp) a = maybeMatch(a, str)
  if (b instanceof RegExp) b = maybeMatch(b, str)

  const r = range(a, b, str)

  return (
    r && {
      start: r[0],
      end: r[1],
      pre: str.slice(0, r[0]),
      body: str.slice(r[0] + a.length, r[1]),
      post: str.slice(r[1] + b.length)
    }
  )
}

/**
 * @param {RegExp} reg
 * @param {string} str
 */
function maybeMatch (reg:any, str:any) {
  const m = str.match(reg)
  return m ? m[0] : null
}

balanced.range = range

/**
 * @param {string} a
 * @param {string} b
 * @param {string} str
 */
function range (a:any, b:any, str:any) {
  let begs, beg, left, right, result
  let ai = str.indexOf(a)
  let bi = str.indexOf(b, ai + 1)
  let i = ai

  if (ai >= 0 && bi > 0) {
    if (a === b) {
      return [ai, bi]
    }
    begs = []
    left = str.length

    while (i >= 0 && !result) {
      if (i === ai) {
        begs.push(i)
        ai = str.indexOf(a, i + 1)
      } else if (begs.length === 1) {
        result = [begs.pop(), bi]
      } else {
        beg = begs.pop()
        if (beg < left) {
          left = beg
          right = bi
        }

        bi = str.indexOf(b, i + 1)
      }

      i = ai < bi && ai >= 0 ? ai : bi
    }

    if (begs.length) {
      result = [left, right]
    }
  }

  return result
}
