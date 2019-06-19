const { tokenize, parse, compileFunctions } = require('../src')

function run (source, context) {
  const tokenTable = tokenize(source)
  const tree = parse(source, tokenTable)
  const factory = compileFunctions(tree)
  const evaluate = factory(context)
  return evaluate()
}

test('index', () => {
  const c = { a: { b: 'hello world!', d: 'b' } }
  expect(run('{{ a[a.d] }}', c)).toBe(c.a.b)
})

test('member', () => {
  const c = { a: { b: 'hello world!' } }
  expect(run('{{ a.b }}', c)).toBe(c.a.b)
  expect(() => run('{{ [1].0 }}', c)).toThrow()
  expect(run('{{ {a:2}.a }}', c)).toBe(2)
})

test('number', () => {
  expect(run('{{ 1 }}', {})).toBe(1)
  expect(run('{{ -1 }}', {})).toBe(-1)
  expect(run('{{ 3.14 }}', {})).toBe(3.14)
  expect(run('{{ 314.15 }}', {})).toBe(314.15)
})

test('object', () => {
  expect(run('{{ {foo:"bar"} }}', {})).toEqual({ foo: 'bar' })
  expect(run('{{ { foo : "bar" } }}', {})).toEqual({ foo: 'bar' })
})

test('ref', () => {
  const c = { hello: 'hello world!' }
  expect(run('{{ hello }}', c)).toBe(c.hello)
})

test('string', () => {
  expect(run('{{ "hi" }}', {})).toBe('hi')
  expect(run('{{ "\\"" }}', {})).toBe('"')
  expect(run('{{ "\\\'" }}', {})).toBe("'")
  expect(() => run('{{ "\\" }}', {})).toThrow()
  expect(run('{{ "\\\\" }}', {})).toBe('\\')
  expect(run('{{ "\\{{" }}', {})).toBe('{{')
  expect(run('{{ \'hi\' }}', {})).toBe('hi')
  expect(() => run('{{ "hi\' }}', {})).toThrow()
  expect(() => run('{{ \'hi" }}', {})).toThrow()
})

test('template', () => {
  expect(() => run('{{', {})).toThrow()
  expect(() => run('{{}}', {})).toThrow()
  expect(run('{{0}}', {})).toBe(0)
  expect(run('{{ 1 }}', {})).toBe(1)
  expect(run('a {{ 2 }} b', {})).toBe('a 2 b')
  expect(run('{{ 3 }}{{ 4 }}', {})).toBe('34')
  expect(() => run('{{ {{ }} }}', {})).toThrow()
  expect(run('{{ "{{ 5 }}" }}', {})).toBe('5')
})
