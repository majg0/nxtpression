const { combineLatest, from, Observable, NEVER } = require('rxjs')
const { toPromise, take, concat } = require('rxjs/operators')
const nxtpr = require('../src')

// describe('array', () => {
//   it('handles a single entry', async () => {
//     await runAsync('{{ [1] }}', {}, x => expect(x).toEqual([1]))
//   })

//   it('handles multiple entries', async () => {
//     await runAsync('{{ [1, 2] }}', {}, x => expect(x).toEqual([1, 2]))
//   })

//   it('handles inner observables', async () => {
//     await runAsync('{{ [foo, 2] }}', { foo: of(1) }, x => expect(x).toEqual([1, 2]))
//   })
// })

// describe('func', () => {
//   it('handles returned observables synchronously', async () => {
//     await runAsync('{{ of(1, 2) }}', { of }, expectToBe(i => i + 1, 2))
//   })

//   it('handles returned observables asynchronously', async () => {
//     await runAsync(
//       '{{ seq(period, num) }}',
//       {
//         period: 50,
//         num,
//         seq: (period, num) => timer(0, period).pipe(take(num))
//       },
//       expectToBe(i => i)
//     )
//   })

//   it('handles returned values', async () => {
//     await runAsync('{{ mul2(2, 3) }}', { mul2 }, x => expect(x).toBe(6))
//   })

//   it('handles returned functions', async () => {
//     await runAsync('{{ div(2) }}', { div }, f => expect(f(6)).toBe(3))
//   })

//   it('handles calling of returned functions', async () => {
//     await runAsync('{{ mul(2)(3) }}', { mul }, x => expect(x).toBe(6))
//   })
// })

// describe('index', () => {
//   it('handles object properties', async () => {
//     await runAsync('{{ a[b] }}', { a: { c: 4 }, b: 'c'  }, x => expect(x).toBe(4))
//   })

//   it('handles observables\'s object properties', async () => {
//     await runAsync('{{ a[b] }}', { a: of({ c: 4 }), b: 'c'  }, x => expect(x).toBe(4))
//   })

//   it('handles indexing with observables', async () => {
//     await runAsync('{{ a[b] }}', { a: { c: 4 }, b: of('c')  }, x => expect(x).toBe(4))
//   })

//   it('handles returned observables', async () => {
//     await runAsync('{{ a[b] }}', { a: { c: of(4) }, b: 'c'  }, x => expect(x).toBe(4))
//   })
// })

// describe('member', () => {
//   it('handles object properties', async () => {
//     await runAsync('{{ foo.bar }}', { foo: { bar: 5 } }, x => expect(x).toBe(5))
//   })

//   it('handles observable\'s object properties', async () => {
//     await runAsync('{{ foo.bar }}', { foo: of({ bar: 5 }) }, x => expect(x).toBe(5))
//   })

//   it('handles returned observables', async () => {
//     await runAsync('{{ foo.bar }}', { foo: { bar: of(5) } }, x => expect(x).toBe(5))
//   })
// })

// describe('null', () => {
//   it('handles the null keyword', async () => {
//     await runAsync('{{ null }}', {}, x => expect(x).toBe(null))
//   })
// })

describe('test', () => {
  it('basic', async () => {
    // mock internals
    const NOT_READY = Symbol('NOT_READY')

    function pipe() {
      const v = arguments[0]
      for (let i = 1; i != arguments.length; ++i) {
        const f = arguments[i]
        if (typeof f !== 'function') {
          throw new Error('unable to pipe to non-function')
        }
        const next = f(v.value)
        for (const ref of next.refs) {
          v.refs.push(ref)
        }
        v.value = next.value
        if (v.value === NOT_READY) {
          return v
        }
      }
      return { ...v, full: true }
    }

    const isEqual = (a, b) => {
      const type = typeof a
      if (type !== typeof b) {
        return false
      }
      if (type === 'object') {
        if (a === null) {
          return b === null
        }

        if (Array.isArray(a)) {
          if (!Array.isArray(b) || a.length !== b.length) {
            return false
          }
          for (let i = 0; i !== a.length; ++i) {
            if (!isEqual(a[i], b[i])) {
              return false
            }
          }
          return true
        }

        for (const [key, value] of Object.entries(a)) {
          if (!isEqual(value, b[key])) {
            return false
          }
        }
        return true
      }
      if (Number.isNaN(a)) {
        return Number.isNaN(b)
      }
      return a === b
    }

    const observe = (get) => {
      return Observable.create(o => {
        const notifiers = []

        function run () {
          const result = get()

          if (result.value !== NOT_READY) {
            o.next(result)
          }

          for (let i = 0; i !== result.refs.length; ++i) {
            const ref = result.refs[i]
            const notifier = notifiers[i]
            if (notifier) {
              if (isEqual(ref, notifier.ref)) {
                continue
              } else {
                notifier.subscription.unsubscribe()
              }
            }
            notifiers[i] = {
              ref,
              subscription: runtime.updaters[ref.type](ref).subscribe(run)
            }
          }
        }

        run()

        return () => {
          for (const { subscription } of notifiers) {
            subscription.unsubscribe()
          }
        }
      })
    }

    // mock external lib
    const ds = {
      cached: {},
      record: {
        get: (name) => {
          if (!ds.cached[name]) {
            ds.cached[name] = new Promise(resolve => setTimeout(() =>
              resolve(name.includes('media') ? 'foo' : 'json'),
              0
            ))
          }
          return ds.cached[name]
        },
        observe: (name) => {
          return from(ds.record.get(name)).pipe(concat(NEVER))
        }
      }
    }

    // mock user-defined runtime
    const runtime = {
      data: {},
      funcs: {
        ds: (domain, path) => (id) => {
          const name = `${id}${domain}`
          const refs = [{ type: 'ds', name }]
          if (!runtime.data.hasOwnProperty(name)) {
            ds.record.get(name).then(x => { runtime.data[name] = x })
            return { refs, value: NOT_READY }
          }
          return { refs, value: runtime.data[name] }
        }
      },
      updaters: {
        ds: ({ name }) => ds.record.observe(name)
      }
    }

    // user-side code
    // const run = nxtpr.plain.compileTemplate('{{ id | ds(":media.source", "input.file") | ds(":file", "mimeType") }}')
    const props = { id: 'test' }
    const x = await observe(
      () => pipe(
        { refs: [], value: props.id },
        runtime.funcs.ds(':media.source', 'input.file'),
        runtime.funcs.ds(':file', 'mimeType')
      )
    ).pipe(take(1)).toPromise()

    console.log(x.value)
  })
})

// describe('number', () => {
//   it('handles integers', async () => {
//     await runAsync('{{ 1 }}', {}, x => expect(x).toBe(1))
//     await runAsync('{{ 12345 }}', {}, x => expect(x).toBe(12345))
//   })

//   it('handles floating point numbers', async () => {
//     await runAsync('{{ 1.2345 }}', {}, x => expect(x).toBe(1.2345))
//     await runAsync('{{ 1234.5 }}', {}, x => expect(x).toBe(1234.5))
//   })
// })

// describe('object', () => {
//   it('handles the empty object', async () => {
//     await runAsync('{{ {} }}', {}, x => expect(x).toEqual({}))
//   })

//   it('handles a single static property name', async () => {
//     await runAsync('{{ {a: 1} }}', {}, x => expect(x).toEqual({a: 1}))
//   })

//   it('handles a single observable property', async () => {
//     await runAsync('{{ {a: foo} }}', { foo: of(1) }, x => expect(x).toEqual({a: 1}))
//   })

//   it('handles multiple static property names', async () => {
//     await runAsync('{{ {a: 1, b: 2} }}', {}, x => expect(x).toEqual({a: 1, b: 2}))
//   })

//   it('handles a single dynamic property name', async () => {
//     await runAsync(
//       '{{ {[a]: 1} }}',
//       { a: 'x' },
//       x => expect(x).toEqual({ x: 1 }))
//   })

//   it('handles a single observable property name', async () => {
//     await runAsync(
//       '{{ {[a]: 1} }}',
//       { a: of('x') },
//       x => expect(x).toEqual({ x: 1 }))
//   })

//   it('handles multiple dynamic property names', async () => {
//     await runAsync(
//       '{{ {[a]: 1, [b]: 2} }}',
//       { a: 'x', b: 'y' },
//       x => expect(x).toEqual({ x: 1, y: 2 })
//     )
//   })

//   it('handles mixed dynamic and static property names', async () => {
//     await runAsync(
//       '{{ {a: 1, [b]: 2} }}',
//       { b: 'y' },
//       x => expect(x).toEqual({ a: 1, y: 2 })
//     )
//   })
// })

// describe('pipe', () => {
//   it('handles piping to func', async () => {
//     await runAsync(
//       '{{ 2 | mul(3) }}',
//       { mul },
//       x => expect(x).toBe(6),
//     )
//   })

//   it('handles piping to ref', async () => {
//     await runAsync(
//       '{{ "ff" | parseHex }}',
//       { parseHex: x => Number.parseInt(x, 16) },
//       x => expect(x).toBe(255),
//     )
//   })

//   it('handles pipes as args', async () => {
//     await runAsync(
//       '{{ x | map(mul(2) | add(1)) }}',
//       { x: [1, 2], map, mul, add },
//       x => expect(x).toEqual([1 * 2 + 1, 2 * 2 + 1])
//     )
//   })

//   it('handles piping more than once', async () => {
//     await runAsync(
//       '{{ stream | sub(5) | mul(2) | add(1) }}',
//       { sub, mul, add, stream: timer(0, 50).pipe(take(num)) },
//       expectToBe(i => (i - 5) * 2 + 1)
//     )
//   })

//   it('handles observables created mid-pipe', async () => {
//     await runAsync(
//       '{{ num | countTo() | mul(2) }}',
//       {
//         countTo: () => num => timer(0, 50).pipe(take(num)),
//         mul,
//         num
//       },
//       expectToBe(i => i * 2)
//     )
//   })
// })

// describe('ref', () => {
//   it('handles non-observable refs', async () => {
//     await runAsync('{{ a }}', { a: 1 }, x => expect(x).toBe(1))
//   })

//   it('handles observable refs', async () => {
//     await runAsync('{{ a }}', { a: of(2) }, x => expect(x).toBe(2))
//   })
// })

// describe('string', () => {
//   it('handles the empty string', async () => {
//     await runAsync('{{ "" }}', {}, x => expect(x).toBe(''))
//   })
//   it('handles a single string part', async () => {
//     await runAsync('{{ "a" }}', {}, x => expect(x).toBe('a'))
//   })
//   it('handles a single nxtpression of the empty string', async () => {
//     await runAsync('{{ "{{ "" }}" }}', {}, x => expect(x).toBe(''))
//   })
//   it('does not convert lone inner nxtpressions to string', async () => {
//     await runAsync('{{ "{{ 1 }}" }}', {}, x => expect(x).toBe(1))
//   })
//   it('converts non-lone inner nxtpressions to string', async () => {
//     await runAsync('{{ "a{{ 1 }}" }}', {}, x => expect(x).toBe('a1'))
//   })
//   it('handles a single inner nxtpression of a single string', async () => {
//     await runAsync('{{ "{{ "a" }}" }}', {}, x => expect(x).toBe('a'))
//   })
//   it('handles combining string parts and nxtpressions', async () => {
//     await runAsync('{{ "hiy{{ "a" }} world" }}', {}, x => expect(x).toBe('hiya world'))
//   })
// })

// describe('boolean', () => {
//   it('handles true', async () => {
//     await runAsync('{{ true }}', {}, x => expect(x).toBe(true))
//   })
//   it('handles false', async () => {
//     await runAsync('{{ false }}', {}, x => expect(x).toBe(false))
//   })
// })

// describe('undefined', () => {
//   it('handles the undefined keyword', async () => {
//     await runAsync('{{ undefined }}', {}, x => expect(x).toBe(undefined))
//   })
// })
