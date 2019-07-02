const { Observable, combineLatest, isObservable, of } = require('rxjs')
const { catchError, map, switchMap, withLatestFrom } = require('rxjs/operators')
const { getErrorFormatter } = require('./util')

const IGNORE = Symbol('ignore')

module.exports = {
  IGNORE,
  compileFromAST
}

function compileFromAST (source, root) {
  const err = getErrorFormatter(source)

  const EXPR_MAP = {
    array: compileArray,
    func: compileFunc,
    index: compileIndex,
    member: compileMember,
    null: compileNull,
    number: compileNumber,
    object: compileObject,
    pipe: compilePipe,
    ref: compileRef,
    string: compileString,
    stringparts: compileStringparts,
    undefined: compileUndefined
  }

  return compileExpr(root)

  function compileExpr (node) {
    return EXPR_MAP[node.type](node)
  }

  function compileNull (node) {
    return context => of(null)
  }

  function compileUndefined (node) {
    return context => of(undefined)
  }

  function compileRef ({ name, col }) {
    return context => {
      const value = context[name]
      if (value === undefined) {
        throw new Error(err(`Undefined variable ${name}`, col))
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
            if (value === IGNORE) {
              return of(value)
            }

            while (index < transforms.length) {
              const transform = transforms[index++]

              if (typeof value === 'function') {
                const func = value
                value = x => transform(func(x))
              } else {
                value = transform(value)
              }

              if (value === IGNORE) {
                return of(value)
              }

              if (isObservable(value)) {
                return value.pipe(
                  switchMap(value => reduce(value, index)),
                  catchError(err => of(null)) // TODO better error handling
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
      return nc.pipe(switchMap(obj => {
        if (!obj) {
          return of(null)
        }
        const value = obj[property]
        if (isObservable(value)) {
          return value
        }
        return of(value)
      }))
    }
  }

  function compilePropPath (node) {
    const { type } = node
    if (type === 'constprop') {
      return context => of(node.value)
    }
    if (type === 'dynprop') {
      return compileExpr(node.expr)
    }
    throw new Error(`unexpected prop path type ${type}`)
  }

  function compileProp ({ path, expr }) {
    const p = compilePropPath(path)
    const e = compileExpr(expr)
    return context => {
      const pc = p(context)
      const ec = e(context)
      return combineLatest(pc, ec, (path, expr) => ({ [path]: expr }))
    }
  }

  function compileObject ({ props }) {
    if (props.length === 0) {
      return context => of({})
    }
    const ps = props.map(compileProp)
    return context => {
      const psc = ps.map(p => p(context))
      return combineLatest(psc, (...xs) => Object.assign(...xs))
    }
  }

  function compileString (node) {
    return context => of(node.body)
  }

  function compileStringparts ({ parts }) {
    if (parts.length === 0) {
      return context => of('')
    }
    if (parts.length === 1) {
      return compileExpr(parts[0])
    }
    const p = parts.map(compileExpr)
    return context => {
      return combineLatest(
        p.map(p => p(context)),
        (...strings) => strings.join('')
      )
    }
  }

  function compileIndex ({ node, expr }) {
    const n = compileExpr(node)
    const e = compileExpr(expr)
    return context => {
      const nc = n(context)
      const ec = e(context)
      return combineLatest(nc, ec).pipe(
        switchMap(([n, e]) => {
          const value = n[e]
          // TODO option to throw on non-existing?
          if (isObservable(value)) {
            return value
          }
          return of(value)
        })
      )
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
}
