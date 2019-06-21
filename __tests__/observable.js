const { Observable, of, timer } = require('rxjs')
const { switchMap, exhaustMap, take, tap } = require('rxjs/operators')
const { tokenize, parse, compileObservables } = require('../src')

function run (source, context) {
  const tokenTable = tokenize(source)
  const tree = parse(source, tokenTable)
  const factory = compileObservables(tree)
  const stream = factory(context)
  return stream
}

async function runAsync (source, context, tests) {
  if (!Array.isArray(tests)) {
    tests = [tests]
  }

  return new Promise((resolve, reject) => {
    let i = 0

    let subscription = run(source, context).subscribe(onNext, onError, onComplete)

    function onNext (x) {
      const f = tests[i]
      if (f === undefined) {
        return onError('too many emissions')
      }
      tests[i] = f(x) // if test is async, save for later
      ++i
    }

    function onError (err) {
      if (subscription && subscription.unsubscribe) {
        subscription.unsubscribe()
        subscription = null
      }
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
        onError('too few emissions')
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

describe('ref', () => {
  it('handles number refs', async () => {
    await runAsync('{{ a }}', { a: 1 }, x => expect(x).toBe(1))
  })

  it('handles observable refs', async () => {
    await runAsync('{{ a }}', { a: of(2) }, x => expect(x).toBe(2))
  })
})

describe('pipe', () => {
  it('handles piping to rxjs operators', async () => {
    await runAsync(
      '{{ timer(0, 50) | take(num) }}',
      { num, timer, take },
      expectToBe(i => i)
    )
  })

  it('detects non-operator function returns and handles them as maps', async () => {
    await runAsync(
      '{{ 2 | mul(3) }}',
      { mul },
      x => expect(x).toBe(6),
    )
  })

  it('handles pipes as args', async () => {
    await runAsync(
      '{{ x | map(mul(2) | add(1)) }}',
      { x: [1, 2], map, mul, add },
      x => expect(x).toEqual([1 * 2 + 1, 2 * 2 + 1])
    )
  })

  it('handles pipes from functions to functions', async () => {
    await runAsync(
      '{{ stream | sub(5) | mul(2) | add(1) }}',
      { sub, mul, add, stream: timer(0, 50).pipe(take(num)) },
      expectToBe(i => (i - 5) * 2 + 1)
    )
  })

  // TODO test: could one pipe a stream like so: {{ stream.pipe(map(add(1)), take(2)) }} ?

  it('handles piping from rxjs operators to functions', async () => {
    await runAsync(
      '{{ timer(0, 50) | take(num) | add(1) }}',
      { num, add, timer, take },
      expectToBe(i => i + 1)
    )
  })

  it('handles piping from functions to rxjs operators', async () => {
    await runAsync(
      '{{ timer(0, 50) | add(1) | take(num) }}',
      { num, add, timer, take },
      expectToBe(i => i + 1)
    )
  })

  it('handles piping from rxjs operators to rxjs operators', async () => {
    await runAsync(
      '{{ timer(0, 50) | take(num) | take(num) }}',
      { num, add, timer, take },
      expectToBe(i => i)
    )
  })
})

test('number', async () => {
  await runAsync('{{ 1 }}', {}, x => expect(x).toBe(1))
})

test('member', async () => {
  await runAsync('{{ foo.bar }}', { foo: { bar: 5 } }, x => expect(x).toBe(5))
})

// test('string', complete => {
//   run('{{ "a" }}', {}).subscribe({
//     next: x => expect(x).toBe("a"),
//     complete
//   })
// })
