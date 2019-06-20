const { Observable, of, timer } = require('rxjs')
const { switchMap, exhaustMap, take } = require('rxjs/operators')
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

    function onNext (x) {
      const f = tests[i]
      if (f === undefined) {
        throw new Error('too many emissions')
      }
      tests[i] = f(x) // if test is async, save for later
      ++i
    }

    async function onComplete () {
      if (i === tests.length) {
        // now await the tests
        Promise
          .all(tests)
          .then(resolve)
          .catch(reject)
      } else {
        reject('too few emissions')
      }
    }

    run(source, context).subscribe(onNext, reject, onComplete)
  })
}

describe('func', () => {
  it('handles observables', async () => {
    await runAsync('{{ of(1, 2) }}', { of }, [
      x => expect(x).toBe(1),
      x => expect(x).toBe(2)
    ])
  })

  it('handles observables asynchronously', async () => {
    const num = 5
    await runAsync(
      '{{ seq(period, num) }}',
      {
        period: 50,
        num,
        seq: (period, num) => timer(0, period).pipe(take(num))
      },
      Array.from({ length: num }, (_, i) =>
        x => expect(x).toBe(i)
      )
    )
  })

  it('handles plain functions', async () => {
    await runAsync('{{ mul(2, 3) }}', { mul: (x, y) => x * y },
      x => expect(x).toBe(6)
    )
  })

  it('handles higher order functions', async () => {
    await runAsync('{{ div(2) }}', { div: y => x => x / y },
      f => expect(f(6)).toBe(3) // TODO should f be observable<function>?
    )
  })
})

describe('ref', () => {
  it('handles plain refs', async () =>
    runAsync('{{ a }}', { a: 1 }, x => expect(x).toBe(1))
  )

  it('handles observable refs', async () =>
    runAsync('{{ a }}', { a: of(2) }, x => expect(x).toBe(2))
  )
})

// test('pipe', complete => {
//   const c = { mul: y => x => x * y }
//   run('{{ 2 | mul(3) }}', c).subscribe({
//     next: x => expect(x).toBe(4),
//     complete
//   })
// })

test('number', () => {
  runAsync('{{ 1 }}', {}, x => expect(x).toBe(1))
})

// test('string', complete => {
//   run('{{ "a" }}', {}).subscribe({
//     next: x => expect(x).toBe("a"),
//     complete
//   })
// })
