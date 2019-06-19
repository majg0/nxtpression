const { Observable, of, timer } = require('rxjs')
const { map } = require('rxjs/operators')
const { tokenize, parse, compileObservables } = require('../src')

function run (source, context) {
  const tokenTable = tokenize(source)
  const tree = parse(source, tokenTable)
  const factory = compileObservables(tree)
  const stream = factory(context)
  return stream
}

// test('func', complete => {
//   let i = 1
//   run('{{ of(1, 2) }}', {}).subscribe({
//     next: val => {
//       expect(val).toBe(i++)
//     },
//     complete
//   })
// })

test('ref', complete => {
  const c = {
    a: 1,
    b: of(1)
  }
  run('{{ a }}', c).subscribe({
    next: x => expect(x).toBe(1),
    complete
  })
  run('{{ b }}', c).subscribe({
    next: x => expect(x).toBe(1),
    complete
  })
})

test('pipe', complete => {
  const c = { mul: y => x => x * y }
  run('{{ 2 | mul(3) }}', c).subscribe({
    next: x => expect(x).toBe(4),
    complete
  })
})

test('number', complete => {
  run('{{ 1 }}', {}).subscribe({
    next: x => expect(x).toBe(1),
    complete
  })
})

test('string', complete => {
  run('{{ "a" }}', {}).subscribe({
    next: x => expect(x).toBe("a"),
    complete
  })
})
