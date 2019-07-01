const { Observable, of, timer } = require('rxjs')
const { switchMap, exhaustMap, take, tap } = require('rxjs/operators')
const nxtpr = require('../src')

async function runAsync (source, context, tests) {
  if (!Array.isArray(tests)) {
    tests = [tests]
  }

  return new Promise((resolve, reject) => {
    let i = 0

    if (typeof source === 'object' && source !== null) {
      nxtpr.compileObjectTemplate(source)(context).subscribe(onNext, onError, onComplete)
    } else {
      nxtpr.produceObservable(source, context).subscribe(onNext, onError, onComplete)
    }

    function onNext (x) {
      const f = tests[i]
      if (f === undefined) {
        return onError(`too many emissions (expected ${tests.length} but aborted at ${i})`)
      }
      tests[i] = f(x) // if test is async, save for later
      ++i
    }

    function onError (err) {
      reject(new Error(err))
    }

    async function onComplete () {
      if (i === tests.length) {
        // now await the tests
        await Promise
          .all(tests)
          .then(resolve)
          .catch(onError)
      } else {
        onError(`too few emissions (expected ${tests.length} but got ${i})`)
      }
    }
  })
}

const num = 5
const sub = y => x => x - y
const div = y => x => x / y
const mul = y => x => x * y
const mul2 = (x, y) => x * y
const add = y => x => x + y
const map = f => x => x.map(f)
const expectToBe = (f, length=num) => Array.from({ length }, (_, i) =>
  x => expect(x).toBe(f(i))
)
const expectToEqual = (f, length=num) => Array.from({ length }, (_, i) =>
  x => expect(x).toEqual(f(i))
)

test('compileObjectTemplate', async () => {
  await runAsync(
    { a: 1, b: { c: '{{ win }}' }, d: '3', e: { f: '{{ 4 }}', } },
    { win: timer(0, 50).pipe(take(5)) },
    expectToEqual(c => ({ a: 1, b: { c }, d: '3', e: { f: 4 } }))
  )
})

describe('array', () => {
  it('handles a single entry', async () => {
    await runAsync('{{ [1] }}', {}, x => expect(x).toEqual([1]))
  })

  it('handles multiple entries', async () => {
    await runAsync('{{ [1, 2] }}', {}, x => expect(x).toEqual([1, 2]))
  })

  it('handles inner observables', async () => {
    await runAsync('{{ [foo, 2] }}', { foo: of(1) }, x => expect(x).toEqual([1, 2]))
  })
})

describe('func', () => {
  it('handles returned observables synchronously', async () => {
    await runAsync('{{ of(1, 2) }}', { of }, expectToBe(i => i + 1, 2))
  })

  it('handles returned observables asynchronously', async () => {
    await runAsync(
      '{{ seq(period, num) }}',
      {
        period: 50,
        num,
        seq: (period, num) => timer(0, period).pipe(take(num))
      },
      expectToBe(i => i)
    )
  })

  it('handles returned values', async () => {
    await runAsync('{{ mul2(2, 3) }}', { mul2 }, x => expect(x).toBe(6))
  })

  it('handles returned functions', async () => {
    await runAsync('{{ div(2) }}', { div }, f => expect(f(6)).toBe(3))
  })

  it('handles calling of returned functions', async () => {
    await runAsync('{{ mul(2)(3) }}', { mul }, x => expect(x).toBe(6))
  })
})

describe('index', () => {
  it('handles object properties', async () => {
    await runAsync('{{ a[b] }}', { a: { c: 4 }, b: 'c'  }, x => expect(x).toBe(4))
  })

  it('handles observables\'s object properties', async () => {
    await runAsync('{{ a[b] }}', { a: of({ c: 4 }), b: 'c'  }, x => expect(x).toBe(4))
  })

  it('handles indexing with observables', async () => {
    await runAsync('{{ a[b] }}', { a: { c: 4 }, b: of('c')  }, x => expect(x).toBe(4))
  })

  it('handles returned observables', async () => {
    await runAsync('{{ a[b] }}', { a: { c: of(4) }, b: 'c'  }, x => expect(x).toBe(4))
  })
})

describe('member', () => {
  it('handles object properties', async () => {
    await runAsync('{{ foo.bar }}', { foo: { bar: 5 } }, x => expect(x).toBe(5))
  })

  it('handles observable\'s object properties', async () => {
    await runAsync('{{ foo.bar }}', { foo: of({ bar: 5 }) }, x => expect(x).toBe(5))
  })

  it('handles returned observables', async () => {
    await runAsync('{{ foo.bar }}', { foo: { bar: of(5) } }, x => expect(x).toBe(5))
  })
})

describe('null', () => {
  it('handles the null keyword', async () => {
    await runAsync('{{ null }}', {}, x => expect(x).toBe(null))
  })
})

describe('number', () => {
  it('handles integers', async () => {
    await runAsync('{{ 1 }}', {}, x => expect(x).toBe(1))
    await runAsync('{{ 12345 }}', {}, x => expect(x).toBe(12345))
  })

  it('handles floating point numbers', async () => {
    await runAsync('{{ 1.2345 }}', {}, x => expect(x).toBe(1.2345))
    await runAsync('{{ 1234.5 }}', {}, x => expect(x).toBe(1234.5))
  })
})

describe('object', () => {
  it('handles the empty object', async () => {
    await runAsync('{{ {} }}', {}, x => expect(x).toEqual({}))
  })

  it('handles a single static property name', async () => {
    await runAsync('{{ {a: 1} }}', {}, x => expect(x).toEqual({a: 1}))
  })

  it('handles a single observable property', async () => {
    await runAsync('{{ {a: foo} }}', { foo: of(1) }, x => expect(x).toEqual({a: 1}))
  })

  it('handles multiple static property names', async () => {
    await runAsync('{{ {a: 1, b: 2} }}', {}, x => expect(x).toEqual({a: 1, b: 2}))
  })

  it('handles a single dynamic property name', async () => {
    await runAsync(
      '{{ {[a]: 1} }}',
      { a: 'x' },
      x => expect(x).toEqual({ x: 1 }))
  })

  it('handles a single observable property name', async () => {
    await runAsync(
      '{{ {[a]: 1} }}',
      { a: of('x') },
      x => expect(x).toEqual({ x: 1 }))
  })

  it('handles multiple dynamic property names', async () => {
    await runAsync(
      '{{ {[a]: 1, [b]: 2} }}',
      { a: 'x', b: 'y' },
      x => expect(x).toEqual({ x: 1, y: 2 })
    )
  })

  it('handles mixed dynamic and static property names', async () => {
    await runAsync(
      '{{ {a: 1, [b]: 2} }}',
      { b: 'y' },
      x => expect(x).toEqual({ a: 1, y: 2 })
    )
  })
})

describe('pipe', () => {
  it('handles piping to func', async () => {
    await runAsync(
      '{{ 2 | mul(3) }}',
      { mul },
      x => expect(x).toBe(6),
    )
  })

  it('handles piping to ref', async () => {
    await runAsync(
      '{{ "ff" | parseHex }}',
      { parseHex: x => Number.parseInt(x, 16) },
      x => expect(x).toBe(255),
    )
  })

  it('handles pipes as args', async () => {
    await runAsync(
      '{{ x | map(mul(2) | add(1)) }}',
      { x: [1, 2], map, mul, add },
      x => expect(x).toEqual([1 * 2 + 1, 2 * 2 + 1])
    )
  })

  it('handles piping more than once', async () => {
    await runAsync(
      '{{ stream | sub(5) | mul(2) | add(1) }}',
      { sub, mul, add, stream: timer(0, 50).pipe(take(num)) },
      expectToBe(i => (i - 5) * 2 + 1)
    )
  })

  it('handles observables created mid-pipe', async () => {
    await runAsync(
      '{{ num | countTo() | mul(2) }}',
      {
        countTo: () => num => timer(0, 50).pipe(take(num)),
        mul,
        num
      },
      expectToBe(i => i * 2)
    )
  })
})

describe('ref', () => {
  it('handles non-observable refs', async () => {
    await runAsync('{{ a }}', { a: 1 }, x => expect(x).toBe(1))
  })

  it('handles observable refs', async () => {
    await runAsync('{{ a }}', { a: of(2) }, x => expect(x).toBe(2))
  })
})

describe('string', () => {
  it('handles the empty string', async () => {
    await runAsync('{{ "" }}', {}, x => expect(x).toBe(''))
  })
  it('handles a single string part', async () => {
    await runAsync('{{ "a" }}', {}, x => expect(x).toBe('a'))
  })
  it('handles a single nxtpression of the empty string', async () => {
    await runAsync('{{ "{{ "" }}" }}', {}, x => expect(x).toBe(''))
  })
  it('does not convert lone inner nxtpressions to string', async () => {
    await runAsync('{{ "{{ 1 }}" }}', {}, x => expect(x).toBe(1))
  })
  it('converts non-lone inner nxtpressions to string', async () => {
    await runAsync('{{ "a{{ 1 }}" }}', {}, x => expect(x).toBe('a1'))
  })
  it('handles a single inner nxtpression of a single string', async () => {
    await runAsync('{{ "{{ "a" }}" }}', {}, x => expect(x).toBe('a'))
  })
  it('handles combining string parts and nxtpressions', async () => {
    await runAsync('{{ "hiy{{ "a" }} world" }}', {}, x => expect(x).toBe('hiya world'))
  })
})

describe('undefined', () => {
  it('handles the undefined keyword', async () => {
    await runAsync('{{ undefined }}', {}, x => expect(x).toBe(undefined))
  })
})
