# :dizzy: nxtpression

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

## :joystick: API

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

Consider running `{{ 4 | ignoreEven | doSideEffect }}` with `ignoreEven: x => x % 2 === 0 ? IGNORE : x`

This will not perform the side effect, because once an IGNORE value is discovered it will be emitted immediately.

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

**NOTE: Everything is an expression - returning either an observable or just a value.**

<details><summary>Array <code>[foo, bar]</code></summary>

```
{{ [1] }}
{{ [1, 2] }}
{{ [foo, 2] }}
```

</details>

<details><summary>Function Call <code>foo(bar)</code></summary>

```
{{ of(1, 2) }}
{{ seq(period, num) }}
{{ mul(2)(3) }}
```

</details>


<details><summary>Index <code>foo[bar]</code></summary>

```
{{ a[b] }}
```

</details>

<details><summary>Member <code>foo.bar</code></summary>

```
{{ foo.bar }}
```

</details>

<details><summary>Null <code>null</code></summary>

```
{{ null }}
```

</details>

<details><summary>Number <code>1.23</code></summary>

WARNING: this does not support scientific notation like `1e3`

```
{{ 12 }}
{{ 1.2345 }}
```

</details>

<details><summary>Object <code>{ foo: foo, [bar]: baz }</code></summary>

Supports both static and dynamic keys

WARNING: does not yet support the same-name utility syntax `{ foo }`

```
{{ {} }}
{{ { a: 1 } }}
{{ { a: foo } }}
{{ { a: 1, b: 2 } }}
{{ { [a]: 1 } }}
{{ { [a]: 1, [b]: 2 } }}
{{ { a: 1, [b]: 2 } }}
```

</details>

<details><summary>Pipe <code>foo | bar</code></summary>

```
{{ 2 | mul(3) }}
{{ "ff" | parseHex }}
{{ stream | sub(5) | mul(2) | add(1) }}
{{ x | map(mul(2) | add(1)) }}
```

</details>

<details><summary>Reference <code>foo</code></summary>

```
{{ a }}
{{ myVar }}
```

</details>

<details><summary>String <code>"foo {{ bar }}"</code></summary>

A bit more complicated, since nested templates are supported.
Strings can be delimited either by `'`s or `"`s.

WARNING: can't use ` delimiters

```
{{ "" }}  // ''
{{ '' }}  // ''
{{ "a" }} // 'a'
{{ "{{ "" }}" }}  // ''
{{ "{{ 1 }}" }}   // 1
{{ "a{{ 1 }}" }}  // 'a1'
{{ "{{ "a" }}" }} // 'a'
{{ "hell{{ "o" }} world" }} // 'hello world'
```

</details>

<details><summary>Undefined <code>undefined</code></summary>

```
{{ undefined }}
```

</details>

## :hourglass_flowing_sand: Roadmap

### Current Priorities

- document supported features in readme
- add standard library
- verify conformance with https://github.com/nxtedition/nxt-lib/blob/master/src/util/template/
- add logical branching

### For Future Consideration

- visual node based editor inspired by UE4 blueprints
- monaco integration

## :trophy: Credit

Inspired by destroyallsoftware’s [a compiler from scratch](https://www.destroyallsoftware.com/screencasts/catalog/a-compiler-from-scratch)
Prior art includes [jinja2](http://jinja.pocoo.org/docs/2.10/) and [nxtedition templates](https://github.com/nxtedition/nxt-lib/tree/master/util/template)
