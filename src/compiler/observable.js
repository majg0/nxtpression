const { of, isObservable } = require('rxjs')

module.exports = {
  compileObservables
}

function compileString ({ body }) {
  return context => of(body)
}

function compileRef ({ name }) {
  return context => {
    const value = context[name]

    if (value === undefined) {
      // TODO augment message with source info
      throw new Error(`Undefined variable ${name}`)
    }

    if (typeof value === 'function') {
      return value
    }

    if (isObservable(value)) {
      return value
    }

    return of(value)
  }
}

function compilePipe ({ left, right }) {
  const l = compileExpr(left)
  const r = compileExpr(right)
  return context => {
    const lc = l(context)
    const rc = r(context)
    throw new Error('compilePipe')
    // if (typeof rc() !== 'function') {
    //   throw new Error('must pipe to function')
    // }
    // return x => {
    //   if (left.type === 'func' && !x) {
    //     return (...args) => rc(lc(...args))
    //   }
    //   return rc(lc(x))
    // }
  }
}

function compileFunc ({ path, args }) {
  const p = compileExpr(path)
  const as = args.map(compileExpr)
  return context => {
    const getFunc = p(context)
    const argGetters = as.map(a => a(context))
    throw new Error('compileFunc')
    // const func = getFunc()
    // const hardArgs = argGetters.map(getArg => getArg())
    // const partial = func(...hardArgs)
    // // console.log('setup', func.name, 'with', hardArgs, 'taking', partial.length, 'more')
    // return (...args) => {
    //   if (args.length === 0) {
    //     if (partial.length === 0) {
    //       // console.log('applying', func.name)
    //       return partial()
    //     }
    //     return partial
    //   }
    //   // console.log('applying', func.name, 'on', args, 'with', hardArgs)
    //   return partial(...args)
    // }
  }
}

function compileMember ({ node, property }) {
  const n = compileExpr(node)
  return context => {
    const nc = n(context)
    throw new Error('compileMember')
    // const obj = nc()
    // if (!Object.hasOwnProperty.call(obj, property)) {
    //   throw new Error(`Undefined property ${property} in object ${JSON.stringify(obj)}`)
    // }
    // return () => obj[property]
  }
}

function compilePropPath (node) {
  const { type } = node
  if (type === 'constprop') {
    const { value } = node
    throw new Error('compilePropPath:constprop')
    // return context => () => value
  }
  if (type === 'dynprop') {
    const e = compileExpr(node.expr)
    throw new Error('compilePropPath:dynprop')
    // return context => e(context)
  }
  throw new Error(`unexpected prop path type ${type}`)
}

function compileProp ({ path, expr }) {
  const p = compilePropPath(path)
  const e = compileExpr(expr)
  return context => {
    const pc = p(context)
    const pe = e(context)
    // return [pc, pe]
    throw new Error('compileProp')
  }
}

function compileObject ({ props }) {
  const ps = props.map(compileProp)
  return context => {
    const psc = ps.map(p => p(context))
    // return () => psc.reduce((o, [p, e]) => ({
    //   ...o,
    //   [p()]: e()
    // }), {})
    throw new Error('compileObject')
  }
}

function compileStringpart (node) {
  const { type } = node
  if (type === 'string') {
    const { body } = node
    // return context => () => body
    throw new Error('compileStringpart')
  }
  return compileExpr(node)
}

function compileStringparts ({ parts }) {
  const p = parts.map(compileStringpart)
  return context => {
    const pc = p.map(p => p(context))
    // return () => pc.reduce((o, x) => o + String(x()), '')
    throw new Error('compileStringparts')
  }
}

function compileIndex ({ node, expr }) {
  const n = compileExpr(node)
  const e = compileExpr(expr)
  return context => {
    const nc = n(context)
    const ec = e(context)
    // return () => nc()[ec()]
    throw new Error('compileIndex')
  }
}

function compileArray ({ items }) {
  const i = items.map(compileExpr)
  return context => {
    const ic = i.map(i => i(context))
    // return () => ic.reduce((o, x) => [
    //   ...o,
    //   x()
    // ], [])
    throw new Error('compileArray')
  }
}

function compileNumber (node) {
  return context => of(node.value)
}

function compileDiv ({ left, right }) {
  const l = compileExpr(left)
  const r = compileExpr(right)
  return context => {
    const lc = l(context)
    const rc = r(context)
    // return () => lc() / rc()
    throw new Error('compileDiv')
  }
}

function compileMul ({ left, right }) {
  const l = compileExpr(left)
  const r = compileExpr(right)
  return context => {
    const lc = l(context)
    const rc = r(context)
    // return () => lc() * rc()
    throw new Error('compileMul')
  }
}

function compilePow ({ left, right }) {
  const l = compileExpr(left)
  const r = compileExpr(right)
  return context => {
    const lc = l(context)
    const rc = r(context)
    // return () => lc() ** rc()
    throw new Error('compilePow')
  }
}

function compileAdd ({ left, right }) {
  const l = compileExpr(left)
  const r = compileExpr(right)
  return context => {
    const lc = l(context)
    const rc = r(context)
    // return () => lc() + rc()
    throw new Error('compileAdd')
  }
}

function compileSub ({ left, right }) {
  const l = compileExpr(left)
  const r = compileExpr(right)
  return context => {
    const lc = l(context)
    const rc = r(context)
    
    throw new Error('compileSub')
    // return () => lc() - rc()
  }
}

function compileExpr (node) {
  const { type } = node
  if (type === 'pipe') {
    return compilePipe(node)
  }
  if (type === 'ref') {
    return compileRef(node)
  }
  if (type === 'func') {
    return compileFunc(node)
  }
  if (type === 'member') {
    return compileMember(node)
  }
  if (type === 'object') {
    return compileObject(node)
  }
  if (type === 'stringparts') {
    return compileStringparts(node)
  }
  if (type === 'index') {
    return compileIndex(node)
  }
  if (type === 'array') {
    return compileArray(node)
  }
  if (type === 'number') {
    return compileNumber(node)
  }
  if (type === 'div') {
    return compileDiv(node)
  }
  if (type === 'mul') {
    return compileMul(node)
  }
  if (type === 'sub') {
    return compileSub(node)
  }
  if (type === 'add') {
    return compileAdd(node)
  }
  if (type === 'pow') {
    return compilePow(node)
  }
  throw new Error(`Unexpected type ${node.type}`)
}

function compileObservables ({ type, body }) {
  if (body.length === 1) {
    return compileExpr(body[0])
  }

  throw new Error('unimplemented!')

  // return body
  //   .map(node => {
  //     if (node.type === 'string') {
  //       return compileString(node)
  //     }
  //     return compileExpr(node)
  //   })
  //   .reduce((o, f) => {
  //     return context => {
  //       const oc = o(context)
  //       const fc = f(context)
  //       return () => oc() + fc()
  //     }
  //   }, context => () => '')
}
