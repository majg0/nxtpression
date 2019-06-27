# nxtpression

Friendly observable-based template library

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

## Roadmap

### Current priorities

- more extensive tests
- better error messages from compile.js
- add logical branching
- add early returns
- asFilter helpers
- document supported features in readme
- verify conformance with https://github.com/nxtedition/nxt-lib/blob/master/src/util/template/
- npm package

### For future consideration

- visual node based editor inspired by UE4 blueprints
- monaco integration

## Credit

Inspired by destroyallsoftware’s [a compiler from scratch](https://www.destroyallsoftware.com/screencasts/catalog/a-compiler-from-scratch)
