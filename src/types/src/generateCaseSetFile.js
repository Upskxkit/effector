//@ts-check

const {promises} = require('fs')
const {resolve} = require('path')
module.exports = {
  generateCaseSetFile,
  matchSomeOfBoolFields,
  boolField,
  dependent,
  printArray,
  permute,
  createTest,
  createDescribe,
  byFields,
  createGroupedCases,
  printBools,
}
function printBools(shape) {
  let result = ''
  for (const key in shape) {
    if (shape[key]) result += `, ${key}`
  }
  return result
}
function createGroupedCases(
  casesDefs,
  {createTestLines, getHash, describeGroup, sortByFields},
) {
  const isAafterB = sortByFields && skewHeapSortFieldsComparator(sortByFields)
  function sortList(list) {
    if (!sortByFields) return [...list]
    return sortListBySkewHeap(list, isAafterB)
  }
  const casesDefsPending = sortList([...casesDefs])
  if (sortByFields) {
    // forIn(sortByFields, prioritySet => {
    //   prioritySet.reverse()
    // })
    casesDefsPending.forEach((e, id) => {
      e.__casesDefsID = id
    })
  }
  const defsGroups = new Map()
  let cur
  while ((cur = casesDefsPending.pop())) {
    const hash = getHash(cur)
    let set = defsGroups.get(hash)
    if (!set) {
      set = {
        itemsPass: [],
        itemsFail: [],
        description: '',
        largeGroup: null,
        noGroup: false,
      }
      defsGroups.set(hash, set)
    }
    ;(cur.pass ? set.itemsPass : set.itemsFail).push(cur)
    const description = describeGroup(cur)
    if (typeof description === 'string') {
      set.description = description
    } else {
      set.noGroup = description.noGroup
      set.description = description.description
      set.largeGroup = description.largeGroup || null
    }
  }
  const descriptions = {}
  for (const [hash, group] of [...defsGroups]) {
    const text = `${group.largeGroup || ''} ${group.description}`
    if (text in descriptions) {
      defsGroups.delete(hash)
      const {itemsPass, itemsFail} = descriptions[text]
      itemsPass.splice(itemsPass.length, 0, ...group.itemsPass)
      itemsFail.splice(itemsFail.length, 0, ...group.itemsFail)
      continue
    }
    descriptions[text] = group
  }
  const largeGroups = {}
  const resultCases = []
  for (let {
    description,
    itemsPass,
    itemsFail,
    noGroup,
    largeGroup,
  } of defsGroups.values()) {
    if (itemsPass.length === 0 && itemsFail.length === 0) continue
    const testSuiteItems = []
    if (itemsPass.length > 0) {
      //itemsPass = sortList(itemsPass)
      const blockOpen = itemsPass.length === 1 ? null : '{'
      const blockClose = itemsPass.length === 1 ? null : '}'
      const itemsFlat = itemsPass.flatMap(item =>
        createTestLines(item).filter(Boolean),
      )
      const items = itemsPass.length === 1 ? itemsFlat : leftPad(itemsFlat)
      testSuiteItems.push(
        createTest(`${description} (should pass)`, [
          '//prettier-ignore',
          blockOpen,
          ...items,
          blockClose,
          'expect(typecheck).toMatchInlineSnapshot()',
        ]),
      )
    }
    if (itemsFail.length > 0) {
      //itemsFail = sortList(itemsFail)
      const blockOpen = itemsFail.length === 1 ? null : '{'
      const blockClose = itemsFail.length === 1 ? null : '}'
      const itemsFlat = itemsFail.flatMap(item =>
        createTestLines(item).filter(Boolean),
      )
      const items = itemsFail.length === 1 ? itemsFlat : leftPad(itemsFlat)
      testSuiteItems.push(
        createTest(`${description} (should fail)`, [
          '//prettier-ignore',
          blockOpen,
          ...items,
          blockClose,
          'expect(typecheck).toMatchInlineSnapshot()',
        ]),
      )
    }
    const lines = []
    if (noGroup || testSuiteItems.length === 1) {
      lines.push(...testSuiteItems)
    } else {
      lines.push(createDescribe(description, testSuiteItems))
    }
    if (largeGroup !== null) {
      if (!(largeGroup in largeGroups)) {
        largeGroups[largeGroup] = []
      }
      largeGroups[largeGroup].push(...lines)
    } else {
      resultCases.push(...lines)
    }
  }
  return [
    ...Object.entries(largeGroups).map(([text, items]) =>
      createDescribe(text, items),
    ),
    ...resultCases,
  ]
}
function printArray(array) {
  return `[${array.join(',')}]`
}
function wrapText(firstLine, lines) {
  return [firstLine, ...leftPad(lines), '})'].join(`\n`)
}
function leftPad(lines) {
  return lines
    .join(`\n`)
    .split(`\n`)
    .map(line => `  ${line}`)
}
function permute(items) {
  if (items.length === 0) return [[]]
  if (items.length === 1) return [[items[0]]]
  if (items.length === 2)
    return [
      [items[0], items[1]],
      [items[1], items[0]],
    ]
  const result = []
  for (let i = 0; i < items.length; i++) {
    const head = items[i]
    const tail = [...items]
    tail.splice(i, 1)
    const subresults = permute(tail)
    for (const subresult of subresults) {
      result.push([head, ...subresult])
    }
  }
  return result
}
function matchSomeOfBoolFields(value, shape) {
  for (const field in shape) {
    if (value[field] === shape[field]) return true
  }
  return false
}

function selectUniqN(items, {n, optional = []}) {
  if (n === 0) return [[]]
  if (n === 1) return items.map(item => [item])
  // if (n > items.length)
  function selectUniqNFlat(items, {n}) {}
}
function createDescribe(description, lines) {
  return wrapText(
    `describe('${description.replace(/\'/gi, '"')}', () => {`,
    lines.filter(Boolean),
  )
}
function createTest(description, lines) {
  return wrapText(
    `test('${description.replace(/\'/gi, '"')}', () => {`,
    lines.filter(Boolean),
  )
}
function byFields(values, {shape = {}}) {
  for (const key in shape) {
    const def = shape[key]
    if (def.union) {
      values = permuteField(values, key, {
        items: def.union,
        amount: {min: 1, max: 1},
        unbox: true,
      })
    }
    if ('value' in def) {
      values = computeField(values, {
        field: key,
        fn: () => def.value,
      })
    }
    if (def.true) {
      values = computeField(values, {
        field: key,
        variant: {
          true: def.true,
          false: {},
        },
        cases: {true: true, false: false},
      })
    }
    if (def.bool) {
      const variantDef = {}
      forIn(def.bool, (val, field) => {
        if (field !== 'true' && field !== 'false') return
        variantDef[field] = val
      })
      if (!variantDef.true) variantDef.true = {}
      if (!variantDef.false) variantDef.false = {}
      values = computeField(values, {
        field: key,
        variant: variantDef,
        cases: {true: true, false: false},
      })
    }
    if (def.compute) {
      if (Array.isArray(def.compute)) {
        for (const subCase of def.compute) {
          if (!subCase.field) subCase.field = key
          values = computeField(values, subCase)
        }
      } else {
        if (!def.compute.field) def.compute.field = key
        values = computeField(values, def.compute)
      }
    }
    if (def.permute) {
      values = permuteField(values, def.permute.field || key, def.permute)
    }

    if (def.flag) {
      const {flag} = def
      const ignoreChecks = []
      const computedFields = {}
      let computedCount = 0
      if (flag.need) flag.needs = flag.need
      if (flag.needs) {
        const needs = Array.isArray(flag.needs) ? flag.needs : [flag.needs]
        for (let i = 0; i < needs.length; i++) {
          const value = needs[i]
          if (typeof value === 'string') continue
          const computedField = `${key}__${computedCount++}`
          computedFields[computedField] = value
          needs[i] = computedField
        }
        ignoreChecks.push(item => {
          if (!item[key]) return true
          return needs.every(field => !!item[field])
        })
      }
      if (flag.avoid) {
        const avoid = Array.isArray(flag.avoid) ? flag.avoid : [flag.avoid]
        for (let i = 0; i < avoid.length; i++) {
          const value = avoid[i]
          if (typeof value === 'string') continue
          const computedField = `${key}__${computedCount++}`
          computedFields[computedField] = value
          avoid[i] = computedField
        }
        ignoreChecks.push(item => {
          if (!item[key]) return true
          return !avoid.some(field => !!item[field])
        })
      }
      if (computedCount > 0) {
        values = byFields(values, {shape: computedFields})
      }
      values = permuteField(values, key, {
        items: [false, true],
        amount: {min: 1, max: 1},
        unbox: true,
        ignore:
          ignoreChecks.length > 0
            ? item => ignoreChecks.every(fn => fn(item))
            : null,
      })
    }
    if (def.split) {
      values = splitField(values, key, def.split)
    }
  }
  return values
}

function splitField(
  values,
  field,
  {cases, variant, match = variant, variants},
) {
  if (variants) {
    const variantGroupNames = Object.keys(variants)
    function buildFullCases(depth, currentCases) {
      const isLastGroup = depth === variantGroupNames.length - 1
      const casesFull = {}
      const variantGroupName = variantGroupNames[depth]
      const variantGroup = variants[variantGroupName]
      function processCase(currentCase) {
        // if current case is plain value then it assumed to be constant value
        if (
          typeof currentCase !== 'object' &&
          typeof currentCase !== 'function'
        ) {
          return {
            compute: {
              fn: () => currentCase,
            },
          }
        }
        if (isLastGroup) {
          return currentCase
        }
        const caseKeys = Object.keys(currentCase)
        const nextGroupName = variantGroupNames[depth + 1]
        const nextGroup = variants[nextGroupName]
        // if next group is string selector or function
        if (
          Array.isArray(nextGroup) ||
          typeof nextGroup !== 'object' ||
          nextGroup === null
        ) {
          // if current case contains only operation names in keys
          // then it is already an operation
          if (
            caseKeys.every(key => {
              switch (key) {
                case 'compute':
                case 'split':
                case 'union':
                case 'flag':
                case 'permute':
                  return true
                default:
                  return false
              }
            })
          ) {
            return currentCase
          }
          // if not every case keys is valid operation name then it is
          // a case record
          return {
            split: {
              match: nextGroup,
              cases: buildFullCases(depth + 1, currentCase),
            },
          }
        }
        const validBranchNames = [...Object.keys(nextGroup), '__']
        // if current case contains invalid branch name then it is an operation
        if (!caseKeys.every(key => validBranchNames.includes(key))) {
          return currentCase
        }
        // create operation for next group in current case
        return {
          split: {
            match: nextGroup,
            cases: buildFullCases(depth + 1, currentCase),
          },
        }
      }
      function processCaseName(caseName) {
        const currentCase = currentCases[caseName]
        if (currentCase === undefined) return
        if (Array.isArray(currentCase)) {
          casesFull[caseName] = currentCase.map(childCase =>
            processCase(childCase),
          )
        } else {
          casesFull[caseName] = processCase(currentCase)
        }
      }
      for (const caseName in variantGroup) {
        processCaseName(caseName)
      }
      processCaseName('__')
      return casesFull
    }
    return splitField(values, field, {
      match: variants[variantGroupNames[0]],
      cases: buildFullCases(0, cases),
    })
  }
  const result = []
  let matcher
  if (typeof match === 'object' && match !== null) {
    const matchCases = {}
    for (const key in match) matchCases[key] = key
    matcher = matchDeep({
      variants: {_: match},
      cases: matchCases,
    })
  } else if (typeof match === 'string') {
    matcher = item => item[match]
  } else {
    matcher = match
  }
  for (const value of values) {
    const matchedCaseName = matcher(value)
    let currentCase = cases[matchedCaseName]
    if (!matchedCaseName || !cases[matchedCaseName]) {
      currentCase = cases.__
    }
    if (!currentCase) {
      result.push(value)
      continue
    }
    if (Array.isArray(currentCase)) {
      result.push(
        ...currentCase.flatMap(subCase =>
          byFields([value], {shape: {[field]: subCase}}),
        ),
      )
    } else {
      result.push(...byFields([value], {shape: {[field]: currentCase}}))
    }
  }
  return result
}
function computeField(values, {field, fn, cases, variants, variant}) {
  if (cases) {
    fn = variants
      ? matchDeep({variants, cases})
      : matchDeep({variants: {_: variant}, cases})
  }
  return values.map(val => ({...val, [field]: fn(val)}))
}
function permuteField(values, field, config) {
  if (Array.isArray(config)) {
    return permuteField(values, field, {
      items: config,
      amount: {min: config.length, max: config.length},
    })
  }
  const {
    items,
    amount: {min = 0, max = items.length - 1} = {},
    ignore,
    unbox,
    required = [],
    noReorder = false,
  } = config
  const results = []
  if (typeof items === 'function') {
    for (const value of values) {
      const valueItems = items(value)
      for (const combination of selectFromNToM(
        valueItems,
        min,
        max,
        noReorder,
      )) {
        if (required.length > 0) {
          if (!required.every(e => combination.includes(e))) continue
        }
        results.push(
          ...values.map(val => ({
            ...val,
            [field]: unbox ? combination[0] : combination,
          })),
        )
      }
    }
  } else {
    for (const combination of selectFromNToM(items, min, max, noReorder)) {
      if (required.length > 0) {
        if (!required.every(e => combination.includes(e))) continue
      }
      results.push(
        ...values.map(val => ({
          ...val,
          [field]: unbox ? combination[0] : combination,
        })),
      )
    }
  }
  if (ignore) return results.filter(ignore)
  return results
}
function selectFromNToM(items, from, to, noReorder) {
  const result = []
  const fn = noReorder ? selectNNoReorder : selectN
  for (let i = from; i < Math.min(to + 1, items.length + 1); i++) {
    result.push(...fn(items, i))
  }
  return result
}
function selectNNoReorder(items, n) {
  if (n > items.length) return [[]]
  if (n === 0) return [[]]
  if (n === 1) return items.map(item => [item])
  const result = []
  const subItems = [...items]
  for (let i = 0; i < items.length; i++) {
    subItems.splice(i, 1)
    result.push(
      ...selectNNoReorder(subItems, n - 1)
        .map(nested => [items[i], ...nested])
        .filter(
          selection => [...new Set(selection)].length === selection.length,
        ),
    )
  }
  return result
}
function selectN(items, n) {
  if (n === 0) return [[]]
  if (n === 1) return items.map(item => [item])
  const result = []
  for (let i = 0; i < items.length; i++) {
    const subItems = [...items]
    subItems.splice(i, 1)
    result.push(
      ...selectN(subItems, n - 1).map(nested => [items[i], ...nested]),
    )
  }
  return result
}

function computeCaseIfMatch(value, matcher, fn) {
  for (const field in matcher) {
    const matcherValue = matcher[field]
    const valueField = value[field]
    if (matcherValue === false) {
      if (valueField !== false && valueField !== undefined) return
    }
    if (matcherValue !== valueField) return
  }
  if (typeof fn === 'function') return fn(value)
  return fn
}

function forIn(value, fn) {
  for (const key in value) {
    const fnResult = fn(value[key], key, value)
    if (fnResult !== undefined) return fnResult
  }
}

function matchDeep({variants: variantGroups, cases}) {
  const matchCases = []
  const variantGroupsNames = Object.keys(variantGroups)
  if (variantGroupsNames.length === 0) return () => {}
  function iterateVariantGroup(index, matcherParts, cases) {
    const isLastVariant = index === variantGroupsNames.length - 1
    forIn(variantGroups[variantGroupsNames[index]], (variant, variantName) => {
      if (Array.isArray(variant)) {
        for (const alt of variant) {
          matchVariant(alt, variantName)
        }
      } else {
        matchVariant(variant, variantName)
      }
      function matchVariant(variant, variantName) {
        const childMatcherParts = [...matcherParts, variant]
        const variantCase = cases[variantName]
        if (variantCase === undefined) return
        if (
          isLastVariant ||
          typeof variantCase !== 'object' ||
          variantCase === null
        ) {
          matchCases.push({
            matcher: Object.assign({}, ...[...childMatcherParts].reverse()),
            variantCase,
          })
          return
        }
        iterateVariantGroup(index + 1, childMatcherParts, variantCase)
      }
    })
  }
  iterateVariantGroup(0, [], cases)
  return value => {
    for (const {matcher, variantCase} of matchCases) {
      const computedResult = computeCaseIfMatch(value, matcher, variantCase)
      if (computedResult !== undefined) return computedResult
    }
  }
}

function boolField() {
  return {type: 'bool'}
}
function dependent(config) {
  if (typeof config === 'function') config = {fn: config, resultType: 'plain'}
  return {
    type: 'dependent',
    fn: config.fn,
    resultType: config.resultType || 'plain',
  }
}
function groupBy(field, descriptionFn) {
  return {type: 'groupBy', field, descriptionFn}
}

async function generateCaseSetFile(config) {
  const suite = generateCaseSet(config)
  const {file, dir, usedMethods = [], header = ''} = config
  const content = `/* eslint-disable no-unused-vars */
import {${usedMethods.join(', ')}} from 'effector'
const typecheck = '{global}'

${header.trim()}

${suite}`

  const srcRoot = resolve(
    __dirname,
    '..',
    '__tests__',
    'effector',
    ...dir.split('/'),
  )
  const fullFileName = resolve(srcRoot, `${file}.test.ts`)
  await promises.writeFile(fullFileName, content)

  function generateCaseSet({
    groupBy = [],
    ignore = [],
    groupDescriptions = {},
    shape,
    generateCases,
  }) {
    groupBy = groupBy.map(val => (typeof val === 'string' ? {field: val} : val))
    const groupByFields = groupBy.map(({field}) => field)
    const valueSet = {}
    const plainShape = {}
    const generationSeq = []
    for (const fieldName in shape) {
      const field = shape[fieldName]
      if (field && field.type) {
        switch (field.type) {
          case 'bool': {
            valueSet[fieldName] = [false, true]
            break
          }
          case 'dependent': {
            generationSeq.push(shape => ({
              ...shape,
              [fieldName]: field.fn(shape),
            }))
            break
          }
        }
      } else {
        plainShape[fieldName] = shape[fieldName]
      }
    }
    let results = [{...plainShape}]
    for (const field in valueSet) {
      const newResults = []
      for (const value of valueSet[field]) {
        newResults.push(...results.map(val => ({...val, [field]: value})))
      }
      results = newResults
    }

    const resultsFlat = results
      .map(item => {
        item = generationSeq.reduce((item, fn) => fn(item), item)
        return item
      })
      .filter(item => {
        if (ignore.length === 0) return true
        return ignore.every(fn => !fn(item))
      })
    const testSuite = []
    for (const resultItem of resultsFlat) {
      const groupValues = groupBy.map(({field}) => ({
        field,
        value: resultItem[field],
      }))
      if (groupValues.length === 0) {
        testSuite.push({type: 'item', value: resultItem})
      } else {
        let currentParent = testSuite
        for (let i = 0; i < groupValues.length; i++) {
          const {field, value} = groupValues[i]
          let newParent = currentParent.find(
            e => e.type === 'group' && e.name === field && e.value === value,
          )
          if (!newParent) {
            newParent = {
              type: 'group',
              name: field,
              value,
              child: [],
            }
            currentParent.push(newParent)
          }
          currentParent = newParent.child
          if (i === groupValues.length - 1) {
            currentParent.push({type: 'item', value: resultItem})
          }
        }
      }
    }
    const testSuiteText = iterateSuite(testSuite).join(`\n`)
    return testSuiteText
    function iterateSuite(suite) {
      const results = []
      for (const item of suite) {
        switch (item.type) {
          case 'item': {
            const generated = generateCases(item.value)
            if (Array.isArray(generated)) {
              for (const {description, cases, noGroup} of generated) {
                if (cases.length > 0) {
                  if (noGroup) {
                    results.push(cases.join(`\n`))
                  } else {
                    results.push(
                      wrapText(`describe('${description}', () => {`, [
                        ...cases,
                      ]),
                    )
                  }
                }
              }
            } else if (generated) {
              const {description, cases, noGroup} = generated
              if (cases.length > 0) {
                if (noGroup) {
                  results.push(cases.join(`\n`))
                } else {
                  results.push(
                    wrapText(`describe('${description}', () => {`, [...cases]),
                  )
                }
              }
            }
            break
          }
          case 'group': {
            const descriptionFn = groupDescriptions[item.name]
            let description = `${item.name}: ${item.value}`
            if (descriptionFn) description = descriptionFn(item.value)
            if (item.child.length === 0) continue
            results.push(
              wrapText(
                `describe('${description}', () => {`,
                iterateSuite(item.child),
              ),
            )
            break
          }
        }
      }
      return results
    }
  }
}
const Heap = {
  merge(a, b, isAafterB) {
    if (!a) return b
    if (!b) return a

    let ret
    if (!isAafterB(a.value, b.value)) {
      ret = a
      a = b
      b = ret
    }
    ret = Heap.merge(a.right, b, isAafterB)
    a.right = a.left
    a.left = ret
    return a
  },
  push(value, queue) {
    queue.top = Heap.merge(
      queue.top,
      {value, left: null, right: null},
      queue.isAafterB,
    )
    queue.size += 1
  },
  pop(queue) {
    if (queue.size === 0) return
    queue.size -= 1
    const value = queue.top.value
    queue.top = Heap.merge(queue.top.left, queue.top.right, queue.isAafterB)
    return value
  },
  create(isAafterB) {
    return {top: null, size: 0, isAafterB}
  },
}

function sortListBySkewHeap(list, isAafterB) {
  const heap = Heap.create(isAafterB)
  list.forEach(e => {
    Heap.push(e, heap)
  })
  const result = []
  let value
  while ((value = Heap.pop(heap))) {
    result.push(value)
  }
  return result
}

function skewHeapSortFieldsComparator(sortByFields) {
  const fields = []
  forIn(sortByFields, (prioritySet, field) => {
    const isVoidFalse =
      prioritySet.includes(false) && !prioritySet.includes(undefined)
    fields.push({
      field,
      isVoidFalse,
      prioritySet: [...prioritySet], //.reverse(),
    })
  })
  return function isAafterB(a, b) {
    for (let i = 0; i < fields.length; i++) {
      const {field, isVoidFalse, prioritySet} = fields[i]
      let aVal = a[field]
      let bVal = b[field]
      if (isVoidFalse) {
        if (aVal === undefined) aVal = false
        if (bVal === undefined) bVal = false
      }
      if (aVal === bVal) continue
      const ai = prioritySet.indexOf(aVal)
      const bi = prioritySet.indexOf(bVal)
      const hasA = ai !== -1
      const hasB = bi !== -1
      if (hasA && !hasB) return false
      if (!hasA && hasB) return true
      if (!hasA && !hasB) continue
      return ai > bi
    }
    const idDiff = a.__casesDefsID - b.__casesDefsID
    if (idDiff !== 0) return idDiff > 0
    console.count('indifferentiated elements')
    console.log(a, b)
    return false
  }
}
