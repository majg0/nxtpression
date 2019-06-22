const { Observable, combineLatest, isObservable, of } = require('rxjs')
const { map, switchMap, withLatestFrom } = require('rxjs/operators')
const { tap } = require('rxjs/operators')
const op = require('rxjs/operators')

module.exports = {
  compileObservables
}

function compileRef ({ name }) {
  return context => {
    const value = context[name]

    if (value === undefined) {
      // TODO augment message with source info
      throw new Error(`Undefined variable ${name}`)
    }

    if (isObservable(value)) {
      return value
    }

    return of(value)
  }
}

let i = 0
let j = 0

function compilePipe ({ parts }) {
  const p = parts.map(compileExpr)
  return context => {
    const p$s = p.map(x => x(context))
    // TODO: can't use combineLatest - if they complete, all ends...
    return combineLatest(p$s).pipe(
      switchMap(([value, ...transforms]) => {
        console.log('start transforming', value, 'with', transforms)
        function reduce (value, index) {
          console.log('red', value, index)
          while (index < transforms.length) {
            const transform = transforms[index++]

            console.log('transforming with', transform)

            if (typeof value === 'function') {
              const func = value
              value = x => transform(func(x))
            } else {
              value = transform(value)
            }

            console.log('produced', value)

            if (isObservable(value)) {
              console.log('switching to...', index)
              return value.pipe(
                switchMap(value => reduce(value, index))
              )
            }
          }

          return of(value)
        }

        return reduce(value, 0)
      })
    )
  }
}

function compileFunc ({ path, args }) {
  const p = compileExpr(path)
  const as = args.map(compileExpr)
  return context => {
    const func$ = p(context)
    const arg$s = as.map(a => a(context))
    return combineLatest(
      func$,
      combineLatest(arg$s)
    ).pipe(
      switchMap(([func, args]) => {
        const result = func(...args)
        if (isObservable(result)) {
          return result
        }
        return of(result)
      })
    )
  }
}

function compileMember ({ node, property }) {
  const n = compileExpr(node)
  return context => {
    const nc = n(context)
    return nc.pipe(map(obj => {
      if (!Object.hasOwnProperty.call(obj, property)) {
        throw new Error(`Undefined property ${property} in object ${JSON.stringify(obj)}`)
      }
      return obj[property]
    }))
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
    return context => () => body
  }
  return compileExpr(node)
}

function compileStringparts ({ parts }) {
  const p = parts.map(compileStringpart)
  return context => {
    const pc = p.map(p => p(context))
    const body = pc.reduce((o, x) => o + String(x()), '')
    return of(body)
  }
}

function compileIndex ({ node, expr }) {
  const n = compileExpr(node)
  const e = compileExpr(expr)
  return context => {
    const nc = n(context)
    const ec = e(context)
    return combineLatest(nc, ec, (n, e) => n[e])
  }
}

function compileArray ({ items }) {
  const i = items.map(compileExpr)
  return context => {
    const ic = i.map(i => i(context))
    return combineLatest(ic)
  }
}

function compileNumber (node) {
  return context => of(node.value)
}

function compileDiv (node) {
  return compileArithmeticExpr(node, (l, r) => l / r)
}

function compileMul (node) {
  return compileArithmeticExpr(node, (l, r) => l * r)
}

function compilePow (node) {
  return compileArithmeticExpr(node, (l, r) => l ** r)
}

function compileAdd (node) {
  return compileArithmeticExpr(node, (l, r) => l + r)
}

function compileSub (node) {
  return compileArithmeticExpr(node, (l, r) => l - r)
}

function compileArithmeticExpr ({ left, right }, fn) {
  const l = compileExpr(left)
  const r = compileExpr(right)
  return context => {
    const lc = l(context)
    const rc = r(context)
    return combineLatest(lc, rc).pipe(map(([l, r]) => fn(l, r)))
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
