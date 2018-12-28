//@flow

import type {Store} from './index.h'
import {getDisplayName} from 'effector/store'
import {Kind} from 'effector/stdlib/kind'
import {__DEBUG__} from 'effector/flags'
import {createName} from '../compositeName'

const storeObjectMaxNames = 25

export function storeObjectArrayName(arr: $ReadOnlyArray<Store<any> | any>) {
  let i = 0
  let name = 'combine('
  for (const store of arr) {
    if (i > storeObjectMaxNames) break
    const comma = i === storeObjectMaxNames ? '' : ', '
    if (store.kind !== Kind.store) {
      name += store.toString() + comma
    } else {
      name += getDisplayName(store) + comma
    }
    i += 1
  }
  name += ')'
  return name
}

export function storeObjectName(obj: {[key: string]: Store<any> | any}) {
  let i = 0
  let name = 'combine('
  for (const key in obj) {
    if (i > storeObjectMaxNames) break
    const store = obj[key]
    const comma = i === storeObjectMaxNames ? '' : ', '
    if (store.kind !== Kind.store) {
      name += store.toString() + comma
    } else {
      name += getDisplayName(store) + comma
    }
    i += 1
  }
  name += ')'
  return name
}

export function setStoreName<State>(store: Store<State>, rawName: string) {
  const compositeName = createName(rawName, store.domainName)
  store.shortName = rawName
  store.compositeName = compositeName
}

function isStoreObject(store: Store<any>) {
  return (
    typeof store.kind !== 'undefined'
    && store.kind === Kind.store
    //$todo
    && typeof store.defaultShape !== 'undefined'
  )
}

export function storeNaming<Obj: {[key: string]: Store<any> | Object}>(
  object: Obj,
  parent?: Store<any>,
) {
  const entries: Array<[string, Store<any>]> = (Object.entries(object): any)
  for (const [storeName, store] of entries) {
    if (parent && store.kind === Kind.store) {
      store.domainName = parent.compositeName || store.domainName
    }

    if (isStoreObject(store)) {
      setStoreName(store, storeName)
      //$todo
      storeNaming(store.defaultShape, store)
      continue
    }

    if (store.kind === Kind.store) {
      setStoreName(store, storeName)
      continue
    }

    if (__DEBUG__)
      console.warn(
        'effector: Key "%s" must be store but instead received %s',
        storeName,
        store.kind || '"' + typeof store + '"',
        store,
      )
  }
}
