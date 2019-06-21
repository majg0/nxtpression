const { Observable, combineLatest, isObservable, of } = require('rxjs')
const { map, switchMap, withLatestFrom } = require('rxjs/operators')
const { tap } = require('rxjs/operators')
const op = require('rxjs/operators')

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

    if (isObservable(value)) {
      return value
    }

    return of(value)
  }
}

let i = 0
let j = 0

function compilePipe ({ left, right }) {
  const l = compileExpr(left)
  const r = compileExpr(right)
  return context => {
    // console.log(++j, 'pipe', left.type, 'to', right.type)
    const l$ = l(context)
    const r$ = r(context)
    // unpack r's OP -> pipe l's x through OP to produce y
    return r$.pipe(
      switchMap(func => {
        // console.log(++i, 'eval', left.type, 'to', right.type)
        if (func.prototype) {
          // assume rxjs operator
          // console.log('piping', func, 'typeof', typeof func)
          return l$.pipe(
            // source => new Observable(o => {
            //   return source.subscribe(
            //     x => {
            //       console.log('got', x, 'in map func, where func is', func)
            //       if (typeof x === 'function') {
            //         return o.next(value => {
            //           console.log('got', value, 'in inner map func, where func is', func)
            //           return func(x(value))
            //         })
            //       }
            //       // func(x)
            //       // console.log(x)
            //       return o.next(func(x))
            //     },
            //     err => o.error(err),
            //     () => o.complete(),
            //   )
            // }),
            //   console.log('myop', x, source)
            //   return
            // },
            // switchMap(x => {
            //   if (typeof x === 'function') {
            //     return value => func(x(value))
            //     return l$
            //   }
            //   return func(x)
            // })

            // tap(x =>
            //   console.log('applying', func, 'typeof', typeof func, 'to', x, 'typeof', typeof x)
            // ),
            func,
            // tap(x =>
            //   console.log('producing', x, typeof x)
            // )
          )
        }
        // cases:
        // THROW value | value
        // value | rxop
        // value | func
        // func | func
        // func | rxop
        // THROW func | value
        // rxop | rxop
        // rxop | func
        // THROW rxop | value

        return l$.pipe(map(x => {
          // console.log('applying', func, 'typeof', typeof func, 'to', x, 'typeof', typeof x, 'producing', func(x), typeof func(x))
          if (typeof x === 'function') {
            return value => func(x(value))
          }
          return func(x)
        }))
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
    // case 1. unpack func and args -> apply args to func to produce SOURCE -> return SOURCE
    // case 2. unpack func and args -> apply args to func to produce OP -> return OP in observable
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
    // return combineLatest(
    //   func$,
    //   combineLatest(arg$s)
    // ).pipe(
    //   switchMap(([func, args]) => {
    //     const result = func(...args)
    //     if (isObservable(result)) {
    //       return result
    //     }
    //     // plain function case
    //     return of(result)
    //   })
    // )
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
