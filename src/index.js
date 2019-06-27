const { combineLatest, of, throwError } = require('rxjs')
const { first, map } = require('rxjs/operators')
const { tokenize } = require('./tokenize')
const { parse } = require('./parse')
const { compileExpr } = require('./compiler')

function isTemplate (value) {
  return typeof value === 'string' && value.indexOf('{{') !== -1
}

function parseAST (source) {
  return parse(source, tokenize(source))
}

function compileTemplate (source) {
  return compileExpr(parseAST(source))
}

function produceObservable (source, context) {
  return compileTemplate(source)(context)
}

async function resolveTemplate (source, context) {
  if (!isTemplate(source)) {
    return Promise.resolve(source)
  }
  try {
    return produceObservable(source, context).pipe(first()).toPromise()
  } catch (err) {
    return Promise.reject(err)
  }
}

async function resolveObjectTemplate (obj, context) {
  try {
    return compileObjectTemplate(obj)(context).pipe(first()).toPromise()
  } catch (err) {
    return Promise.reject(err)
  }
}

function compileObjectTemplate (obj) {
  if (!isPlainObject(obj)) {
    throw new Error('invalid argument')
  }

  const resolvers = []
  // TODO (fix): Make iterative
  function compile (p, o) {
    for (const [k, v] of Object.entries(o)) {
      const pk = [...p, k]
      if (typeof v === 'object' && v !== null) {
        compile(pk, v)
      } else if (isTemplate(v)) {
        resolvers.push([pk, compileTemplate(v)])
      } else {
        resolvers.push([pk, context => of(v)])
      }
    }
  }
  compile([], obj)

  return context => resolvers.length === 0
    ? of(obj)
    : combineLatest(
      resolvers.map(([p, resolver]) => resolver(context).pipe(map(x => [p, x]))),
      (...resolved) => resolved.reduce((acc, [path, value]) => {
        const p = [...path]
        let obj = acc
        const lastIndex = p.length - 1
        while (p.length > 1) {
          const prop = p.shift()
          if (!obj[prop]) {
            obj[prop] = {}
          }
          obj = obj[prop]
        }
        obj[p.shift()] = value
        return acc
      }, {})
    )
}


module.exports = {
  compileObjectTemplate,
  produceObservable,
  tokenize
}

// https://github.com/lodash/lodash/blob/aa1d7d870d9cf84842ee23ff485fd24abf0ed3d1/isPlainObject.js
function isPlainObject (value) {
  if (
    typeof value !== 'object' ||
    value == null ||
    Object.prototype.toString(value) != '[object Object]'
  ) {
    return false
  }
  if (Object.getPrototypeOf(value) === null) {
    return true
  }
  let proto = value
  while (Object.getPrototypeOf(proto) !== null) {
    proto = Object.getPrototypeOf(proto)
  }
  return Object.getPrototypeOf(value) === proto
}
