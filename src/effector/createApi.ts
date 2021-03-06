import {Store, Event} from './unit.h'
import {createEvent, applyParentHook} from './createUnit'
import {forIn} from './collection'
import {getParent} from './getter'
import {processArgsToConfig} from './config'

export function createApi(...args: [Store<any>, {[key: string]: Function}]) {
  let [[store, setters], metadata] = processArgsToConfig(args)
  const result: Record<string, Event<any>> = {}
  forIn(setters, (fn, key) => {
    const event = (result[key] = createEvent(key, {
      parent: getParent(store),
      config: metadata,
    }))
    store.on(event, fn)
    applyParentHook(store, event)
  })
  return result
}
