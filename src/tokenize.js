const { getErrorFormatter } = require('./util')

const ESCAPED = {
  '\\\\': '\\',
  '\\"': '"',
  '\\\'': "'",
  '\\{{': '{{'
}

module.exports = {
  ESCAPED,
  tokenize
}

const TOKENS = [
  { re: /^\s+/, type: 'whitespace' },
  { re: /^{{/, type: 'otemplate' },
  { re: /^}}/, type: 'ctemplate' },
  { re: /^\|/, type: 'pipe' },
  { re: /^,/, type: 'comma' },
  { re: /^[a-zA-Z][a-zA-Z0-9]*/, type: 'identifier' },
  { re: /^-?[0-9]+(?:\.[0-9]+)?/, type: 'number' },
  { re: /^\(/, type: 'oround' },
  { re: /^\)/, type: 'cround' },
  { re: /^"/, type: 'dquote' },
  { re: /^'/, type: 'squote' },
  { re: /^\[/, type: 'osquare' },
  { re: /^]/, type: 'csquare' },
  { re: /^{/, type: 'ocurly' },
  { re: /^}/, type: 'ccurly' },
  { re: /^:/, type: 'colon' },
  { re: /^(?:\^|\*\*)/, type: 'pow' },
  { re: /^\*/, type: 'mul' },
  { re: /^\//, type: 'div' },
  { re: /^\+/, type: 'add' },
  { re: /^-/, type: 'sub' },
  { re: /^\./, type: 'member' },
  { re: /^undefined/, type: 'undefined' },
  { re: /^null/, type: 'null' },
  { re: /^[^\\]+?(?={{|"|\\)/, type: 'string' },
  {
    re: new RegExp(`^(?:${Object
      .keys(ESCAPED)
      .map(x => x.replace(/\\/g, '\\\\'))
      .join('|')})`),
    type: 'escaped'
  }
]

function tokenize (source) {
  let i = 0
  const err = getErrorFormatter(source, () => i)
  const NC = source.length
  const NT = TOKENS.length
  const result = []
  for (; i !== NC;) {
    const s = source.slice(i)
    let m = null
    let ti = 0
    for (; ti !== NT; ++ti) {
      m = s.match(TOKENS[ti].re)
      if (m) {
        break
      }
    }
    if (!m) {
      throw new Error(err('Invalid token'))
    }
    const ni = i + m[0].length
    const type = TOKENS[ti].type
    result.push({
      type,
      start: i,
      body: source.slice(i, ni)
    })
    i = ni
  }
  return result
}
