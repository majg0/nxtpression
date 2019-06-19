# nxtpression

## What / Why

Originally aimed at replacing a hacky compiler for a nxtedition-internal template language inspired by jinja2 templates, in order to be able to provide more advanced language features and tooling around it

Intends to draw some inspirated from observablehq

The following contrived example shows the basic idea

```js
'carrot {{ ids | map(slice(2)) | join("") }} stick?'
 // { ids: ['foo', 'bar'] } -> 'carrot or stick?'
 // { ids: ['..&'] } -> 'carrot & stick?'
```

## How

Basically [this](https://www.destroyallsoftware.com/screencasts/catalog/a-compiler-from-scratch)

## Roadmap

### Current priorities

- compile to reactive templates
- add tests, reduce surface area, better errors
- conform with (compileTemplate, resolveTemplate, compileObjectTemplate) as found at https://github.com/nxtedition/nxt-lib/blob/master/src/util/template/index.js

### For future consideration

- documentation, tutorial
- dedicated website
- visual node based editor inspired by UE4 blueprints
- integration with monaco
