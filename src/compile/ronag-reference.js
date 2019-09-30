
const id = 'test'
const expr = '{{ id | ds(":file", "mimeType") }}'

{ value, refs } = run(props === { id: 'test' }, data === {}, expr)

refs === [ 'test:file' ]

context = Observable.merge(refs.map(ref => ds.record.observe(ref)))

value = run(
  props === { id: 'test' }, 
  data === { 'test:file' },
  { mimeType: 'json' }},
  expr
)

function run (getImpl) {
  let refs = new Set()
  const get = id => {
    refs.add(id)
    return getImpl(id)
  }
  const value = evaluate({ get })
  return { value, refs: Array.from(refs) }
}




function *runExpression () {
  while (true) {
    const { value, refs } = await run(context)
    yield value
    await refs.change
  }
}

async function runExpression(context, template, get) {
  return {
    value,
    refs
  }
}


ds: (name) => get(name)

// ds.record.observe(name)

function observableExpression (context, template) {
  return Observable.create(o => {
    const subscriptions = []

    async function run () {
      const { value, refs } = await runExpression(context, template, key => ds.record.get(key))
      o.next(value)
      for (const subscription of subscriptions) {
        subscription.unsubscribe()
      }
      for (const ref of refs) {
        subscriptions.push(ds.record.observe(ref).subscribe(run))
      }
    }

    return () => {
      for (const subscription of subscriptions) {
        subscription.unsubscribe()
      }
    }
  })
}


function viewExpression () {

}



async function myCouchView (doc, emit, get) {
  if (doc is file domain) {
    const asd = await get(`${id}:file.meta`)
  }
}