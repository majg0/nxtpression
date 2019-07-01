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

<details><summary><code>tokenize: source => tokens</code></summary>

Tokenizes source string. Will throw on unexpected token.

</details>

<details><summary><code>parseFromTokens: (source, tokens) => AST</code></summary>

Parses tokens into abstract syntax tree. Will throw on invalid semantics.

</details>

<details><summary><code>parseFromSource: source => AST</code></summary>

This utility function will `tokenize` and `parseFromTokens` in one go.

</details>

<details><summary><code>compileFromAST: (source, AST) => (context => Observable)</code></summary>

Compiles a template string from an AST. Will not throw.

</details>

<details><summary><code>IGNORE: Symbol</code></summary>

Consider running

```
{{ 4 | ignoreEven | doSideEffect }}
```

with

```js
ignoreEven: x => x % 2 === 0 ? IGNORE : x
```

This will not perform the side effect.

WARNING: this WILL emit the `IGNORE` symbol once, in order to ensure that observables complete.

</details>

<details><summary><code>isTemplate: string => Boolean</code></summary>

If a value is a string containing `'{{'`, this will return `true`.

WARNING: this is a quick guess, if you need to be certain, please parse the string and make sure no error is thrown.

</details>

<details><summary><code>compileTemplate: source => (context => Observable)</code></summary>

This utility function will `tokenize`, `parseFromTokens` and `compileFromAST` in one go.

</details>

<details><summary><code>compileObjectTemplate: obj => (context => Observable)</code></summary>

Compiles and combines all templates in an object recursively.

WARNING: templates in arrays are not supported.

</details>

<details><summary><code>produceObservable: (source, context) => Observable</code></summary>

This utility function will just `compileTemplate(source)(context)`.

</details>

<details><summary><code>resolveTemplate: (source, context) => Promise</code></summary>

This creates a `Promise` awaiting the first value emitted by a template compiled from source directly when applied with the given context.

</details>

<details><summary><code>resolveObjectTemplate: (obj, context) => Promise</code></summary>

Like `resolveTemplate` but for object templates, this `Promise`s the latest value of all template strings once they all have emitted at least once.

</details>

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
