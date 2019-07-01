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

You can get much fancier than that!

## API

### Core

#### `tokenize // source => tokens`

Tokenizes source string. Will throw on unexpected token.

#### `parseFromTokens // (source, tokens) => AST`

Parses tokens into abstract syntax tree. Will throw on invalid semantics.

#### `parseFromSource // source => AST`

This utility function will `tokenize` and `parseFromTokens` in one go.

#### `compileFromAST // (source, AST) => (context => Observable)`

Compiles a template string from an AST. Will not throw.

#### `IGNORE // Symbol('ignore')`

Consider running `{{ 4 | ignoreEven | doSideEffect }}`, with `ignoreEven: x => x % 2 === 0 ? IGNORE : x`. 
This will not perform the side effect.
WARNING: this WILL emit the `IGNORE` symbol once, in order to ensure that observables complete.

#### `isTemplate // string => Boolean`

If a value is a string containing `'{{'`, this will return `true`.
WARNING: this is a quick guess, if you need to be certain, please parse the string and make sure no error is thrown.

#### `compileTemplate // source => (context => Observable)`

This utility function will `tokenize`, `parseFromTokens` and `compileFromAST` in one go.

#### `compileObjectTemplate // obj => (context => Observable)`

Compiles and combines all templates in an object recursively.
WARNING: templates in arrays are not supported.

#### `produceObservable // (source, context) => Observable`

This utility function will just `compileTemplate(source)(context)`.

#### `resolveTemplate // (source, context) => Promise`

This creates a `Promise` awaiting the first value emitted by a template compiled from source directly when applied with the given context.

#### `resolveObjectTemplate // (obj, context) => Promise`

Like `resolveTemplate` but for object templates, this `Promise`s the latest value of all template strings once they all have emitted at least once.

### Syntax

For the most detailed info, read [__tests__/observable.js](__tests__/observable.js).

## Roadmap

### Current priorities

- add standard library
- document supported features in readme
- verify conformance with https://github.com/nxtedition/nxt-lib/blob/master/src/util/template/
- add logical branching

### For future consideration

- visual node based editor inspired by UE4 blueprints
- monaco integration

## Credit

Inspired by destroyallsoftware’s [a compiler from scratch](https://www.destroyallsoftware.com/screencasts/catalog/a-compiler-from-scratch)
