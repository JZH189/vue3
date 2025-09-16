 
// Vue 3 Ref useDirectValue 逻辑示例演示

import {
  isReadonly,
  isShallow,
  reactive,
  readonly,
  ref,
  shallowReactive,
  shallowRef,
  toRaw,
} from '../packages/vue/src/index.js'

// 演示函数：显示 useDirectValue 逻辑
function demonstrateRefLogic() {
  console.info('=== Vue 3 Ref useDirectValue 逻辑示例演示 ===\n')

  // 示例 1: 普通 ref + 普通对象
  console.info('📍 示例 1: 普通 ref 设置普通对象')
  const normalRef = ref({ name: 'Alice' })
  const plainObj = { name: 'Bob' }

  console.info('条件检查:')
  console.info('  this[IS_SHALLOW]:', false, '(普通 ref)')
  console.info('  isShallow(newValue):', isShallow(plainObj), '(普通对象)')
  console.info('  isReadonly(newValue):', isReadonly(plainObj), '(可写对象)')
  console.info('  useDirectValue =', false)
  console.info('  执行: newValue = toRaw(newValue)')

  normalRef.value = plainObj
  console.info('结果: 新值被转换为响应式\n')

  // 示例 2: shallowRef + 任何对象
  console.info('📍 示例 2: shallowRef 设置对象')
  const shallowRefExample = shallowRef({ count: 0 })
  const anyObj = { count: 1 }

  console.info('条件检查:')
  console.info('  this[IS_SHALLOW]:', true, '(shallowRef)')
  console.info('  isShallow(newValue):', isShallow(anyObj))
  console.info('  isReadonly(newValue):', isReadonly(anyObj))
  console.info('  useDirectValue =', true, '(因为 this[IS_SHALLOW] = true)')
  console.info('  执行: newValue = newValue (直接使用)')

  shallowRefExample.value = anyObj
  console.info('结果: 直接使用新值，不进行响应式转换\n')

  // 示例 3: 普通 ref + shallow 对象
  console.info('📍 示例 3: 普通 ref 设置 shallow 响应式对象')
  const normalRef2 = ref({ x: 1 })
  const shallowObj = shallowReactive({ x: 2 })

  console.info('条件检查:')
  console.info('  this[IS_SHALLOW]:', false, '(普通 ref)')
  console.info(
    '  isShallow(newValue):',
    isShallow(shallowObj),
    '(shallow 对象)',
  )
  console.info('  isReadonly(newValue):', isReadonly(shallowObj))
  console.info('  useDirectValue =', true, '(因为 isShallow(newValue) = true)')
  console.info('  执行: newValue = newValue (直接使用)')

  normalRef2.value = shallowObj
  console.info('结果: 保持 shallow 特性\n')

  // 示例 4: 普通 ref + readonly 对象
  console.info('📍 示例 4: 普通 ref 设置 readonly 对象')
  const normalRef3 = ref({ y: 1 })
  const readonlyObj = readonly({ y: 2 })

  console.info('条件检查:')
  console.info('  this[IS_SHALLOW]:', false, '(普通 ref)')
  console.info('  isShallow(newValue):', isShallow(readonlyObj))
  console.info(
    '  isReadonly(newValue):',
    isReadonly(readonlyObj),
    '(readonly 对象)',
  )
  console.info('  useDirectValue =', true, '(因为 isReadonly(newValue) = true)')
  console.info('  执行: newValue = newValue (直接使用)')

  normalRef3.value = readonlyObj
  console.info('结果: 保持 readonly 特性\n')

  // 示例 5: 普通 ref + reactive 对象
  console.info('📍 示例 5: 普通 ref 设置 reactive 对象')
  const normalRef4 = ref({ z: 1 })
  const reactiveObj = reactive({ z: 2 })

  console.info('条件检查:')
  console.info('  this[IS_SHALLOW]:', false, '(普通 ref)')
  console.info(
    '  isShallow(newValue):',
    isShallow(reactiveObj),
    '(reactive 对象)',
  )
  console.info('  isReadonly(newValue):', isReadonly(reactiveObj))
  console.info('  useDirectValue =', false)
  console.info('  执行: newValue = toRaw(newValue) (提取原始值)')
  console.info('  原因: 避免嵌套代理，然后重新包装')

  console.info('toRaw(reactiveObj):', toRaw(reactiveObj))
  normalRef4.value = reactiveObj
  console.info('结果: 提取原始值后重新包装为响应式\n')

  console.info('=== 总结 ===')
  console.info('useDirectValue 的三个条件 (OR 关系):')
  console.info('1. this[IS_SHALLOW]: 当前是 shallowRef')
  console.info('2. isShallow(newValue): 新值是 shallow 响应式')
  console.info('3. isReadonly(newValue): 新值是 readonly')
  console.info('')
  console.info('✅ 任一条件为 true → 直接使用新值')
  console.info('❌ 全部为 false → 使用 toRaw() 提取原始值')
  console.info('')
  console.info('目的: 正确处理不同类型的响应式对象，避免嵌套代理')
}

// 运行演示
demonstrateRefLogic()
