module.exports = {
  parse
}

function parse (source, tokenTable) {
  function err (text, start) {
    if (start === undefined) {
      start = tokenTable[0].start
    }
    const AROUND = 38
    throw new Error(`At ${start}; ${text} \n\`${
      source.slice(Math.max(0, start - AROUND), start + AROUND).replace(/\n/g, ' ')
    }\`\n${' '.repeat(Math.min(start, AROUND) + 1) + '^'}`)
  }

  function consume (expectedType) {
    const token = tokenTable.shift()
    if (!expectedType || token.type === expectedType) {
      return token
    }
    err(`Expected ${expectedType} but got ${token.type}`, token.start)
  }

  function peek () {
    return tokenTable[0].type
  }

  function parseArgsList () {
    consume('oround')
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
    err('Unexpected template termination')
  }

  function parseFunc (path) {
    const args = parseArgsList()
    return { type: 'func', path, args }
  }

  function parseIdentifier () {
    return { type: 'ref', name: consume().body }
  }

  function parseObject () {
    consume('ocurly')
    const props = []
    while (tokenTable.length) {
      const at = peek()

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
        err('dquote prop')
      }

      if (at === 'squote') {
        err('squote prop')
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

      err('Unexpected token')
    }
    err('Unexpected template termination')
  }

  function parseQuote (quoteType) {
    consume(`${quoteType}quote`)
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
      str += consume().body
    }
    err('Unexpected template termination')
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
    consume('member')
    while (tokenTable.length) {
      const at = peek()
      if (at === 'whitespace') {
        consume()
        continue
      }
      if (at !== 'identifier') {
        err('Expected identifier')
      }
      const identifier = consume()
      return { type: 'member', node, property: identifier.body }
    }
    err('Unexpected template termination')
  }

  function parseArray () {
    consume('osquare')
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
    err('Unexpected template termination')
  }

  function parseNumber () {
    return { type: 'number', value: Number(consume('number').body) }
  }

  function parsePipe (left) {
    consume('pipe')
    return { type: 'pipe', left, right: parseExpr() }
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
          err('expected expression')
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
          err('Expected expression')
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

      err('Unexpected token')
    }
    err('Unexpected template termination')
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
