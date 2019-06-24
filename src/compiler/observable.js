const { Observable, combineLatest, isObservable, of } = require('rxjs')
const { map, switchMap, withLatestFrom } = require('rxjs/operators')
const { tap } = require('rxjs/operators')
const op = require('rxjs/operators')

module.exports = {
  compileObservables
}

const EXPR_MAP = {
  add: compileAdd,
  array: compileArray,
  div: compileDiv,
  func: compileFunc,
  index: compileIndex,
  member: compileMember,
  mul: compileMul,
  number: compileNumber,
  object: compileObject,
  pipe: compilePipe,
  pow: compilePow
  ref: compileRef,
  stringparts: compileStringparts,
  sub: compileSub
}

function compileRef ({ name }) {
  return context => {
    const value = context[name]
    if (value === undefined) {
      // TODO augment message with source info
      throw new Error(`Undefined variable ${name}`)
    }
    return isObservable(value) ? value : of(value)
  }
}

function compilePipe ({ parts }) {
  const p = parts.map(compileExpr)
  return context => {
    const p$s = p.map(x => x(context))
    return combineLatest(p$s).pipe(
      switchMap(([value, ...transforms]) => {
        function reduce (value, index) {
          while (index < transforms.length) {
            const transform = transforms[index++]

            if (typeof value === 'function') {
              const func = value
              value = x => transform(func(x))
            } else {
              value = transform(value)
            }

            if (isObservable(value)) {
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

    if (arg$s.length === 0) {
      return func$.pipe(switchMap(func => {
        const result = func()
        return isObservable(result) ? result : of(result)
      }))
    }

    return func$.pipe(
      switchMap(func => combineLatest(arg$s).pipe(
        switchMap(args => {
          const result = func(...args)
          return isObservable(result) ? result : of(result)
        })
      ))
    )
  }
}

function compileMember ({ node, property }) {
  const n = compileExpr(node)
  return context => {
    const nc = n(context)
    return nc.pipe(map(obj => {
      if (!Object.hasOwnProperty.call(obj, property)) {
        // TODO remove?
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
    return context => of(body)
  }
  return compileExpr(node)
}

function compileStringparts ({ parts }) {
  const p = parts.map(compileStringpart)
  return context => {
    const pc = p.map(p => p(context))
    throw new Error('compileStringparts')
    // const body = pc.reduce((o, x) => o + String(x()), '')
    // return of(body)
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
    if (ic.length === 0) {
      return of([])
    }
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
  return EXPR_MAP[node.type](node)
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
