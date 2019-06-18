const { tokenize, parse, compile } = require('../index')

test('runs', () => {
  const source = `{{
    id |
    string.append({a: ' a'}.a) |
    string.append({[prop]: 'ib'}[prop]) |
    array.concat([1.3, 'casdfaib']) |
    array.map(
      string.slice(2) |
      string.split("a{{
        id[1 / (2 ^ 2 - 3)]
      }}") |
      string.append(context.mystr)
    )
  }}`

  const tokenTable = tokenize(source)
  const tree = parse(source, tokenTable)
  const factory = compile(tree)
  const evaluate = factory({
    id: 'myid',
    prop: 'myprop',
    context: {
      mystr: '(hehe)'
    },
    array: {
      concat: b => x => (Array.isArray(x) ? x : [x]).concat(b),
      map: f => x => (Array.isArray(x) ? x : [x]).map(f),
    },
    JSON: {
      stringify: () => JSON.stringify.bind(JSON),
      parse: () => JSON.parse.bind(JSON)
    },
    string: {
      append: b => x => String(x) + String(b),
      slice: (b, c) => x => String(x).slice(b, c),
      split: b => x => String(x).split(b)
    },
  })

  expect(evaluate()).toEqual(['id ,b(hehe)', '3(hehe)', 'sdf,b(hehe)'])
})