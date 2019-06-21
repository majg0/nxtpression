const { ESCAPED } = require('./tokenize')
const { getErrorFormatter } = require('./util')

module.exports = {
  parse
}

function parse (source, tokenTable) {
  const err = getErrorFormatter(
    source, () => tokenTable.length === 0 ? source.length : tokenTable[0].start
  )

  function consume (expectedType) {
    const token = tokenTable.shift()
    if (!expectedType || token.type === expectedType) {
      return token
    }
    throw new Error(err(`Expected ${expectedType} but got ${token.type}`, token.start))
  }

  function peek () {
    return tokenTable[0].type
  }

  function parseArgsList () {
    const oround = consume('oround')
    const body = []
    while (tokenTable.length) {
      const at = peek()

      if (at === 'cround') {
        consume()
        return body
      }

      if (at === 'comma') {
        consume()
        continue
      }

      body.push(parseExpr())
    }
    throw new Error(err('Argument list not closed', oround.start))
  }

  function parseFunc (path) {
    const args = parseArgsList()
    return { type: 'func', path, args }
  }

  function parseIdentifier () {
    return { type: 'ref', name: consume().body }
  }

  function parseObject () {
    const ocurly = consume('ocurly')
    const props = []
    while (tokenTable.length) {
      const at = peek()

      if (at === 'whitespace') {
        consume()
        continue
      }

      if (at === 'identifier') {
        const ident = consume().body
        if (peek() === 'whitespace') {
          consume()
        }
        consume('colon')
        const expr = parseExpr()
        props.push({
          path: {
            type: 'constprop',
            value: ident
          },
          expr
        })
        continue
      }

      if (at === 'dquote') {
        throw new Error(err('dquote prop'))
      }

      if (at === 'squote') {
        throw new Error(err('squote prop'))
      }

      if (at === 'osquare') {
        consume()
        const ident = parseExpr()
        consume('csquare')
        if (peek() === 'whitespace') {
          consume()
        }
        consume('colon')
        const expr = parseExpr()
        props.push({
          path: {
            type: 'dynprop',
            expr: ident
          },
          expr
        })
        continue
      }

      if (at === 'ccurly') {
        consume()
        return { type: 'object', props }
      }

      throw new Error(err(`Unexpected token ${at}`))
    }
    throw new Error(err('Object not closed', ocurly.start))
  }

  function parseQuote (quoteType) {
    const xquote = consume(`${quoteType}quote`)
    const parts = []
    let str = ''
    while (tokenTable.length) {
      const at = peek()

      if (at === 'otemplate') {
        if (str) {
          parts.push({ type: 'string', body: str })
          str = ''
        }
        parts.push(parseTemplate())
        continue
      }

      if (at === `${quoteType}quote`) {
        consume()
        if (str) {
          parts.push({ type: 'string', body: str })
        }
        return { type: 'stringparts', parts }
      }

      const token = consume()
      if (token.type === 'escaped') {
        str += ESCAPED[token.body]
      } else {
        str += token.body
      }
    }
    throw new Error(err('String not closed', xquote.start))
  }

  function parseIndexDeref (node) {
    consume('osquare')
    const expr = parseExpr()
    consume('csquare')
    return { type: 'index', node, expr }
  }

  function parseDiv (left) {
    consume('div')
    return { type: 'div', left, right: parseExpr() }
  }

  function parseMul (left) {
    consume('mul')
    return { type: 'mul', left, right: parseExpr() }
  }

  function parseAdd (left) {
    consume('add')
    return { type: 'add', left, right: parseExpr() }
  }

  function parseSub (left) {
    consume('sub')
    return { type: 'sub', left, right: parseExpr() }
  }

  function parsePow (left) {
    consume('pow')
    return { type: 'pow', left, right: parseExpr() }
  }

  function parseMemberAccess (node) {
    const member = consume('member')
    if (peek() === 'whitespace') {
      consume()
    }
    return { type: 'member', node, property: consume('identifier').body }
  }

  function parseArray () {
    const osquare = consume('osquare')
    const items = []
    while (tokenTable.length) {
      const at = peek()

      if (at === 'csquare') {
        consume()
        return { type: 'array', items }
      }

      if (at === 'comma') {
        consume()
        continue
      }

      items.push(parseExpr())
    }
    throw new Error(err('Array not terminated', osquare.start))
  }

  function parseNumber () {
    return { type: 'number', value: Number(consume('number').body) }
  }

  function parsePipe (left) {
    consume('pipe')
    const right = parseExpr()
    if (right.type === 'pipe') {
      return { type: 'pipe', parts: [left, ...right.parts] }
    }
    return { type: 'pipe', parts: [left, right] }
  }

  function parseExprGroup () {
    consume('oround')
    const expr = parseExpr()
    consume('cround')
    return expr
  }

  function parseExpr () {
    let prev
    while (tokenTable.length) {
      const at = peek()

      if (at === 'whitespace') {
        consume()
        continue
      }

      if (at === 'pipe') {
        prev = parsePipe(prev)
        continue
      }

      if (at === 'ccurly' || at === 'cround' || at === 'csquare' || at === 'comma' || at === 'ctemplate') {
        if (!prev) {
          throw new Error(err('expected expression'))
        }
        return prev
      }

      if (at === 'identifier') {
        prev = parseIdentifier()
        continue
      }

      if (at === 'oround') {
        if (!prev) {
          prev = parseExprGroup()
        } else {
          prev = parseFunc(prev)
        }
        continue
      }

      if (at === 'ocurly') {
        prev = parseObject()
        continue
      }

      if (at === 'osquare') {
        if (prev) {
          prev = parseIndexDeref(prev)
        } else {
          prev = parseArray()
        }
        continue
      }

      if (at === 'squote') {
        prev = parseQuote('s')
        continue
      }

      if (at === 'dquote') {
        prev = parseQuote('d')
        continue
      }

      if (at === 'member') {
        if (!prev) {
          throw new Error(err('Expected expression'))
        }
        prev = parseMemberAccess(prev)
        continue
      }

      if (at === 'number') {
        prev = parseNumber()
        continue
      }

      // TODO precedence / order?

      if (at === 'div') {
        prev = parseDiv(prev)
        continue
      }

      if (at === 'mul') {
        prev = parseMul(prev)
        continue
      }

      if (at === 'add') {
        prev = parseAdd(prev)
        continue
      }

      if (at === 'sub') {
        prev = parseSub(prev)
        continue
      }

      if (at === 'pow') {
        prev = parsePow(prev)
        continue
      }

      if (at === 'otemplate') {
        throw new Error(err('Can only open templates inside strings'))
      }
    }
    throw new Error(err('Expression not terminated'))
  }

  function parseTemplate () {
    const otemplate = consume('otemplate')
    const expr = parseExpr()
    if (peek() === 'whitespace') {
      consume()
    }
    consume('ctemplate')
    return expr
  }

  function parseRootContext () {
    const body = []
    let str = ''
    while (tokenTable.length) {
      const at = peek()
      if (at === 'otemplate') {
        if (str) {
          body.push({ type: 'string', body: str })
          str = ''
        }
        body.push(parseTemplate())
        continue
      }
      str += consume().body
    }
    if (str) {
      body.push({ type: 'string', body: str })
    }
    return { type: 'root', body }
  }

  return parseRootContext()
}
