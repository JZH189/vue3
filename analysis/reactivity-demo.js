 
// Vue 3 响应式系统简易实现 Demo

/**
 * 简易响应式系统实现
 * 包含依赖收集、触发更新、性能优化等核心功能
 */
class MiniVueReactivity {
  constructor() {
    this.activeEffect = null // 当前活跃的 effect
    this.targetMap = new WeakMap() // 存储所有依赖关系
    this.shouldTrack = true // 是否应该进行依赖收集
    this.effectStack = [] // effect 调用栈
    this.updateQueue = [] // 更新队列
    this.isFlushPending = false // 是否有待处理的更新
  }

  /**
   * 创建响应式对象
   */
  reactive(target) {
    if (typeof target !== 'object' || target === null) {
      return target
    }

    return new Proxy(target, {
      get: (obj, key) => {
        // 依赖收集
        this.track(obj, key)

        const result = Reflect.get(obj, key)

        // 深度响应式：如果值是对象，递归创建代理
        if (typeof result === 'object' && result !== null) {
          return this.reactive(result)
        }

        return result
      },

      set: (obj, key, value) => {
        const oldValue = obj[key]
        const result = Reflect.set(obj, key, value)

        // 只有值真正改变时才触发更新
        if (oldValue !== value && this.hasChanged(oldValue, value)) {
          this.trigger(obj, key, value, oldValue)
        }

        return result
      },

      deleteProperty: (obj, key) => {
        const hadKey = Object.prototype.hasOwnProperty.call(obj, key)
        const result = Reflect.deleteProperty(obj, key)

        if (result && hadKey) {
          this.trigger(obj, key, void 0, obj[key])
        }

        return result
      },
    })
  }

  /**
   * 创建 ref 对象
   */
  ref(value) {
    const ref = {
      __isRef: true,
      _value: this.convert(value),

      get value() {
        this.track(ref, 'value')
        return this._value
      },

      set value(newValue) {
        const oldValue = this._value
        this._value = this.convert(newValue)

        if (this.hasChanged(oldValue, this._value)) {
          this.trigger(ref, 'value', this._value, oldValue)
        }
      },
    }

    return ref
  }

  /**
   * 转换值（如果是对象则创建响应式）
   */
  convert(value) {
    return typeof value === 'object' && value !== null
      ? this.reactive(value)
      : value
  }

  /**
   * 检查值是否发生变化
   */
  hasChanged(oldValue, newValue) {
    return !Object.is(oldValue, newValue)
  }

  /**
   * 依赖收集
   */
  track(target, key) {
    // 如果没有活跃的 effect 或者不应该追踪，直接返回
    if (!this.activeEffect || !this.shouldTrack) {
      return
    }

    // 获取目标对象的依赖映射
    let depsMap = this.targetMap.get(target)
    if (!depsMap) {
      this.targetMap.set(target, (depsMap = new Map()))
    }

    // 获取特定属性的依赖集合
    let dep = depsMap.get(key)
    if (!dep) {
      depsMap.set(key, (dep = new Set()))
    }

    // 建立双向关联
    if (!dep.has(this.activeEffect)) {
      dep.add(this.activeEffect)
      this.activeEffect.deps.push(dep)
    }
  }

  /**
   * 触发更新
   */
  trigger(target, key, newValue, oldValue) {
    const depsMap = this.targetMap.get(target)
    if (!depsMap) return

    const deps = []

    // 收集需要执行的依赖
    if (key !== void 0) {
      const dep = depsMap.get(key)
      if (dep) {
        deps.push(dep)
      }
    }

    // 执行收集到的所有依赖
    const effects = []
    deps.forEach(dep => {
      dep.forEach(effect => {
        if (effect !== this.activeEffect) {
          effects.push(effect)
        }
      })
    })

    this.triggerEffects(effects)
  }

  /**
   * 执行副作用函数
   */
  triggerEffects(effects) {
    effects.forEach(effect => {
      if (effect.scheduler) {
        effect.scheduler()
      } else {
        this.runEffect(effect)
      }
    })
  }

  /**
   * 运行单个 effect
   */
  runEffect(effect) {
    if (!effect.active) return

    try {
      this.effectStack.push(this.activeEffect)
      this.activeEffect = effect

      // 清理旧的依赖关系
      this.cleanupEffect(effect)

      return effect.fn()
    } finally {
      this.activeEffect = this.effectStack.pop()
    }
  }

  /**
   * 清理 effect 的依赖
   */
  cleanupEffect(effect) {
    effect.deps.forEach(dep => {
      dep.delete(effect)
    })
    effect.deps.length = 0
  }

  /**
   * 创建副作用函数
   */
  effect(fn, options = {}) {
    const effect = {
      fn,
      active: true,
      deps: [],
      scheduler: options.scheduler,

      run: () => this.runEffect(effect),
      stop: () => {
        if (effect.active) {
          this.cleanupEffect(effect)
          effect.active = false
        }
      },
    }

    // 立即执行一次
    this.runEffect(effect)

    return effect
  }

  /**
   * 计算属性
   */
  computed(getter) {
    let value
    let dirty = true
    let effect

    const computedRef = {
      __isRef: true,

      get value() {
        if (dirty) {
          value = this.runEffect(effect)
          dirty = false
        }
        this.track(computedRef, 'value')
        return value
      },

      set value(newValue) {
        // computed 通常是只读的，这里可以扩展支持 setter
        console.warn('Computed is readonly')
      },
    }

    effect = {
      fn: getter,
      active: true,
      deps: [],
      scheduler: () => {
        if (!dirty) {
          dirty = true
          this.trigger(computedRef, 'value')
        }
      },
    }

    return computedRef
  }

  /**
   * 批量更新（简化版）
   */
  nextTick(fn) {
    return Promise.resolve().then(fn)
  }

  /**
   * 停止依赖收集
   */
  pauseTracking() {
    this.shouldTrack = false
  }

  /**
   * 恢复依赖收集
   */
  resumeTracking() {
    this.shouldTrack = true
  }
}

// 创建全局实例
const reactivity = new MiniVueReactivity()

// 导出 API
const reactive = target => reactivity.reactive(target)
const ref = value => reactivity.ref(value)
const effect = (fn, options) => reactivity.effect(fn, options)
const computed = getter => reactivity.computed(getter)

// ===== 示例和测试 =====

console.info('=== Vue 3 响应式系统 Demo ===\n')

// 1. 基础响应式测试
console.info('1. 基础响应式测试:')
const state = reactive({
  count: 0,
  user: {
    name: 'Vue',
    age: 3,
  },
})

effect(() => {
  console.info(`  Count: ${state.count}`)
})

effect(() => {
  console.info(`  User: ${state.user.name} v${state.user.age}`)
})

console.info('  修改 count...')
state.count = 1
state.count = 2

console.info('  修改 user...')
state.user.name = 'Vue.js'
state.user.age = 4
console.info()

// 2. Ref 测试
console.info('2. Ref 响应式测试:')
const message = ref('Hello')
const number = ref(42)

effect(() => {
  console.info(`  Message: ${message.value}`)
})

effect(() => {
  console.info(`  Number: ${number.value}`)
})

console.info('  修改 ref 值...')
message.value = 'Hello Vue 3'
number.value = 100
console.info()

// 3. 计算属性测试
console.info('3. 计算属性测试:')
const firstName = ref('Zhang')
const lastName = ref('San')

const fullName = computed(() => {
  console.info('  计算 fullName...')
  return `${firstName.value} ${lastName.value}`
})

effect(() => {
  console.info(`  Full Name: ${fullName.value}`)
})

console.info('  修改 firstName...')
firstName.value = 'Li'

console.info('  修改 lastName...')
lastName.value = 'Si'

console.info('  再次访问 fullName (应该使用缓存):')
console.info(`  Full Name: ${fullName.value}`)
console.info()

// 4. 数组响应式测试
console.info('4. 数组响应式测试:')
const list = reactive(['a', 'b', 'c'])

effect(() => {
  console.info(`  List length: ${list.length}`)
  console.info(`  List items: ${list.join(', ')}`)
})

console.info('  添加元素...')
list.push('d')

console.info('  修改元素...')
list[0] = 'A'

console.info('  删除元素...')
list.pop()
console.info()

// 5. 嵌套响应式测试
console.info('5. 嵌套响应式测试:')
const nested = reactive({
  level1: {
    level2: {
      value: 'deep',
    },
  },
})

effect(() => {
  console.info(`  Deep value: ${nested.level1.level2.value}`)
})

console.info('  修改深层属性...')
nested.level1.level2.value = 'very deep'
console.info()

// 6. Effect 停止测试
console.info('6. Effect 停止测试:')
const stopTest = ref(0)

const runner = effect(() => {
  console.info(`  Stop test value: ${stopTest.value}`)
})

console.info('  修改值 (应该触发):')
stopTest.value = 1

console.info('  停止 effect:')
runner.stop()

console.info('  再次修改值 (不应该触发):')
stopTest.value = 2
console.info()

// 7. 性能测试
console.info('7. 性能测试:')
const perfState = reactive({ counter: 0 })
let effectRunCount = 0

effect(() => {
  effectRunCount++
  console.info(
    `  Effect 运行次数: ${effectRunCount}, Counter: ${perfState.counter}`,
  )
})

console.info('  批量修改 (测试是否会重复触发):')
perfState.counter = 1
perfState.counter = 2
perfState.counter = 3

console.info()
console.info('=== Demo 结束 ===')

// 导出供外部使用
// API 已在上方定义，可以直接使用
console.info('可用 API: reactive, ref, effect, computed')
