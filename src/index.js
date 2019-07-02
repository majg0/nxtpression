const { combineLatest, of, throwError } = require('rxjs')
const { first, map } = require('rxjs/operators')
const { tokenize } = require('./tokenize')
const { parseFromTokens } = require('./parse')
const { IGNORE, compileFromAST } = require('./compiler')

module.exports = {
  IGNORE,
  compileFromAST,
  compileObjectTemplate,
  compileTemplate,
  isTemplate,
  parseFromSource,
  parseFromTokens,
  produceObservable,
  resolveObjectTemplate,
  resolveTemplate,
  tokenize
}

function isTemplate (value) {
  return typeof value === 'string' && value.indexOf('{{') !== -1
}

function parseFromSource (source) {
  return parseFromTokens(source, tokenize(source))
}

function compileTemplate (source) {
  return compileFromAST(source, parseFromSource(source))
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
        const x = Array.isArray(v) ? [] : {}
        resolvers.push([pk, context => of(x)])
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
        while (p.length > 1) {
          const prop = p.shift()
          obj = obj[prop]
        }
        obj[p.shift()] = value
        return acc
      }, {})
    )
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
