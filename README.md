# nxtpression

Friendly observable-based template expression library.

```js
const { of } = require('rxjs')
const nxtpr = require('nxtpression')

nxtpr.produceObservable('{{names|greet}}', {
  names: of("Mike", "Ike"),
  greet: x => `Hi ${x}.`
}).subscribe(console.log)
// Hi Mike.
// Hi Ike.
```

You can get much fancier than that though!

## :baby_symbol: Syntax Reference

**NOTE: Every expression represents a stream of values. Mix and match as you see wish!**

```js
{{ [{ [currentKey]: currentInput }] | map(currentlySelectedTransform | processResult(currentScheduler)) }}
```

### Array `[foo, bar]`

```js
{{ [1] }}
{{ [1, 2] }}
{{ [foo, 2] }}
```

### Boolean `true` / `false`

```js
{{ true }}
{{ false }}
```

### Function Call `foo(bar)`

Note that no currying is performed.

```js
{{ of(1, 2) }}
{{ seq(period, num) }}
{{ mul(2)(3) }}
```

### Index `foo[bar]`

```js
{{ a[b] }}
```

### Member `foo.bar`

```js
{{ foo.bar }}
```

### Null `null`

```js
{{ null }}
```

### Number `1.23`

WARNING: this does not support scientific notation like `1e3`

```js
{{ 12 }}
{{ 1.2345 }}
```

### Object `{ foo: foo, [bar]: baz }`

Supports both static and dynamic keys

WARNING: does not yet support the same-name utility syntax `{ foo }`

```js
{{ {} }}
{{ { a: 1 } }}
{{ { a: foo } }}
{{ { a: 1, b: 2 } }}
{{ { [a]: 1 } }}
{{ { [a]: 1, [b]: 2 } }}
{{ { a: 1, [b]: 2 } }}
```

### Pipe `foo | bar`

```js
{{ 2 | mul(3) }}
{{ "ff" | parseHex }}
{{ stream | sub(5) | mul(2) | add(1) }}
{{ x | map(mul(2) | add(1)) }}
```

### Reference `foo`

```js
{{ a }}
{{ myVar }}
```

### String `"foo {{ bar }}"`

A bit more complicated, since nested templates are supported.
Strings can be delimited by either `'`s or `"`s.

WARNING: templates inside non-empty strings will have to convert all emissions to `String`.

WARNING: can't use ` delimiters

```js
{{ "" }}  // ''
{{ '' }}  // ''
{{ "a" }} // 'a'
{{ "{{ "" }}" }}  // ''
{{ "{{ 1 }}" }}   // 1
{{ "a{{ 1 }}" }}  // 'a1'
{{ "{{ "a" }}" }} // 'a'
{{ "hell{{ "o" }} world" }} // 'hello world'
```

### Undefined `undefined`

```js
{{ undefined }}
```

## :candle: Core API

The core design is really simple.

1. Tokenize (look at source code and find where the tokens are - information is found)
2. Parse (take the tokens and produce a tree structure of nodes - relationships appear)
3. Compile (create a factory function, mapping a context to an observable - code becomes callable)
4. Inject a context (inject streams and values to produce a composite stream as defined in the template)
5. Subscribe the stream! :bowling:

For more information on steps 1-3, watch the destroyallsoftware screencast linked in the bottom for a terrific 30 minute short introduction on writing a compiler from scratch. For more information on steps 4-5, learn RxJS.

### `tokenize`: `(source) => tokens` (throws on unexpected token)

Tokenizes the source string and returns an `Array` of tokens.

Notably, a string is not a string until it has been parsed.
An actual string is formed during parsing.

- `type`: `String`; For a list of possible values, see `tokenize.js`
- `start`: `Number`; The index in the source string where the token starts.
- `body`: `String`; The full slice of text as copied from the source string.

### `parseFromTokens`: `(source, tokens) => AST` (throws on invalid semantics)

Parses tokens into an abstract syntax tree - a recursive structure of nodes.

A node has the following shape: `{ type, ...properties }`

- `func` - a function (`path`: optional parent node, `args` - array of nodes called with)
- `ref` - a reference (`name`: `token.body`, `col`: `token.start`)
- `boolean` - a boolean (`value`: the parsed `Boolean` value)
- `object` - an object (`props`: array of `{ path, expr }` nodes - there are two types of `path`, see below)
  - `constprop` - a statically named property (`value`: the static name of the property)
  - `dynprop` - a dynamically named property (`expr`: a node representing an expression for the property name)
- `stringparts` - a string possibly containing a nxtpression (`parts`: a list of nodes of varying type)
  - `string` - a string literal (`body`: the raw string value)
- `index` - an index into something (`node`: the node representing something to index a property off of, `expr`: the node representing the value to index off of the thing)
- `member` - a member access (`node`: the node representing something to access a property off of, `property`: the name of the property to access)
- `array` - an array (`items`: array of nodes reprenting the values in the array)
- `number` - a number (`value`: the parsed `Number` value)
- `pipe` - a function piping the left hand side to the right hand side (`parts`: the nodes representing the objects to pipe through. Most of the time, the first node will reference a value from context and the other nodes are functions to pipe that value through)
- `null` - the value `null` (n/a)
- `undefined` - the value `undefined` (n/a)

### `compileFromAST`: `(source, AST, options) => (context => Observable)` (throws on undefined variable access if enabled)

Compiles a template string from an AST.

The `options` object supports the following properties:

- `throwOnUndefinedVariableAccess` - if `true`, will throw when a value referenced in the context is `undefined` (default: `false`)

### `IGNORE`: `Symbol`

Consider running `{{ 4 | ignoreEven | doSideEffect }}`, with `ignoreEven: x => x % 2 === 0 ? IGNORE : x`.
This will not perform the side effect, because once an `IGNORE` symbol is discovered, the symbol will be emitted immediately.

*WARNING*: this WILL still emit once - with the `IGNORE` symbol - in order to ensure that observables complete.

## :wheelchair: :joystick: Utility API

There are some nice utilities to make your life easier. Basically just some wrappers around the core API and a heuristic to help determining whether a string might contain a template.

### `isNotATemplate`: `(string) => Boolean` (does not throw)

If `string` is not a `String` containing `'{{'`, this will return `true`.

*WARNING*: this is only a heuristic when returning `false`. If you need to be certain, please parse the string and make sure no error is thrown.

### `parseFromSource`: `(source) => AST` (throws on unexpected token or invalid semantics)

This utility function will `tokenize` and `parseFromTokens` in one go.

### `compileTemplate`: `(source, options) => (context => Observable)` (throws on unexpected token or invalid semantics or - if enabled, undefined variable access)

This utility function will `tokenize`, `parseFromTokens` and `compileFromAST` in one go.
For a list of options, see `compileFromAST`.

### `produceObservable`: `(source, context, options) => Observable` (throws on unexpected token or invalid semantics or - if enabled, undefined variable access)

This utility function will just `compileTemplate(source, options)(context)`.
For a list of options, see `compileFromAST`.

### `resolveTemplate`: `(source, context, options) => Promise` (throws on unexpected token or invalid semantics or - if enabled, undefined variable access)

This creates a `Promise` awaiting the first value emitted by a template compiled from source directly when applied with the given context.
For a list of options, see `compileFromAST`.

## :grapes: Object Templates API

An object template is a recursive structure of arrays and objects containing template strings, e.g.

```js
{
  a: [{ b: '{{ 1 }}' }],
  c: { d: '{{ 2 }}' },
  e: '{{ 3 }}'
} // => { a: [{ b: 1 }], c: { d: 2 }, e: 3 }
```

However, it does not work recursively in returned values

```js
resolveObjectTemplate({ a: '{{ t }}' }, { t: '{{ 1 }}' }) // { a: '{{ 1 }}' }
```

### `compileObjectTemplate`: `(obj, options) => (context => Observable)` (throws on unexpected token or invalid semantics or - if enabled, undefined variable access)

Compiles and combines all templates in an object or array recursively.
For a list of options, see `compileFromAST`.

### `produceObjectObservable`: `(obj, context, options) => Observable` (throws on unexpected token or invalid semantics or - if enabled, undefined variable access)

This utility function will just `compileObjectTemplate(source, options)(context)`.
For a list of options, see `compileFromAST`.

### `resolveObjectTemplate`: `(obj, context, options) => Promise` (throws on unexpected token or invalid semantics or - if enabled, undefined variable access)

Like `resolveTemplate` but for object templates, this `Promise`s the latest value of all template strings once they all have emitted at least once.
For a list of options, see `compileFromAST`.

## :electric_plug: Installation

With [npm](https://www.npmjs.com/get-npm) installed;

```sh
npm i nxtpression
```

## :trophy: Credit

Inspired by destroyallsoftware’s [a compiler from scratch](https://www.destroyallsoftware.com/screencasts/catalog/a-compiler-from-scratch).

Prior art includes [jinja2](http://jinja.pocoo.org/docs/2.10/) and [nxtedition templates](https://github.com/nxtedition/nxt-lib/tree/master/util/template).
