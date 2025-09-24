import type { ReactiveEffect } from './effect'
import { warn } from './warning'

// 当前活跃的 effect scope，全局变量
export let activeEffectScope: EffectScope | undefined

/**
 * EffectScope 类 - 用于管理响应式副作用的作用域
 *
 * Effect Scope 是 Vue 3 中用于收集和管理响应式副作用（如 computed、watch 等）的容器。
 * 它提供了一种机制来批量清理这些副作用，避免内存泄漏，特别适用于组件卸载、路由切换等场景。
 *
 * 主要功能：
 * 1. 收集在其作用域内创建的所有响应式副作用
 * 2. 支持嵌套作用域管理
 * 3. 提供批量暂停/恢复副作用的能力
 * 4. 支持作用域停止时的清理回调
 * 5. 优化的内存管理和垃圾回收
 */
export class EffectScope {
  /**
   * 作用域是否处于活跃状态
   * @internal
   */
  private _active = true

  /**
   * 追踪 `on` 方法的调用次数，允许多次调用 `on` 方法
   * 用于实现引用计数机制，确保作用域的正确激活和停用
   * @internal
   */
  private _on = 0

  /**
   * 存储在此作用域内创建的所有响应式副作用
   * 当作用域停止时，这些副作用也会被停止
   * @internal
   */
  effects: ReactiveEffect[] = []

  /**
   * 存储清理回调函数数组
   * 当作用域停止时，这些回调函数会被执行，用于清理资源
   * @internal
   */
  cleanups: (() => void)[] = []

  /**
   * 作用域是否处于暂停状态
   * 暂停状态下的作用域不会执行副作用，但仍然是活跃的
   * @internal
   */
  private _isPaused = false

  /**
   * 父级作用域引用
   * 只有非独立（non-detached）的作用域才会有父级作用域
   * 用于构建作用域的层级关系和内存管理
   * @internal
   */
  parent: EffectScope | undefined

  /**
   * 子作用域数组
   * 记录所有非独立的子作用域，用于级联操作（如停止、暂停等）
   * @internal
   */
  scopes: EffectScope[] | undefined

  /**
   * 当前作用域在父作用域的 scopes 数组中的索引
   * 用于优化移除操作，实现 O(1) 时间复杂度的删除
   * @internal
   */
  private index: number | undefined

  /**
   * 构造函数 - 创建一个新的 EffectScope 实例
   *
   * @param detached 是否为独立作用域
   *                 - false（默认）: 非独立作用域，会自动成为当前活跃作用域的子作用域
   *                 - true: 独立作用域，不会建立父子关系，需要手动管理生命周期
   */
  constructor(public detached = false) {
    // 设置父级作用域为当前活跃的作用域
    this.parent = activeEffectScope

    // 如果不是独立作用域且存在活跃的父级作用域
    if (!detached && activeEffectScope) {
      // 将当前作用域添加到父级作用域的子作用域列表中
      // 并记录在父级作用域中的索引位置，用于后续的优化删除
      this.index =
        (activeEffectScope.scopes || (activeEffectScope.scopes = [])).push(
          this,
        ) - 1
    }
  }

  /**
   * 获取作用域的活跃状态
   *
   * @returns 作用域是否处于活跃状态
   */
  get active(): boolean {
    return this._active
  }

  /**
   * 暂停作用域及其所有子作用域和副作用
   *
   * 暂停操作是可逆的，不会销毁作用域，只是临时停止执行。
   * 暂停后可以通过 resume() 方法恢复执行。
   *
   * 执行顺序：
   * 1. 设置当前作用域为暂停状态
   * 2. 递归暂停所有子作用域
   * 3. 暂停当前作用域内的所有副作用
   */
  pause(): void {
    if (this._active) {
      // 标记为暂停状态
      this._isPaused = true
      let i, l

      // 递归暂停所有子作用域
      if (this.scopes) {
        for (i = 0, l = this.scopes.length; i < l; i++) {
          this.scopes[i].pause()
        }
      }

      // 暂停当前作用域内的所有副作用
      for (i = 0, l = this.effects.length; i < l; i++) {
        this.effects[i].pause()
      }
    }
  }

  /**
   * 恢复作用域及其所有子作用域和副作用的执行
   *
   * 只有处于暂停状态的作用域才能被恢复。
   * 恢复操作会递归地恢复所有子作用域和副作用的执行。
   *
   * 执行顺序：
   * 1. 检查作用域是否活跃且处于暂停状态
   * 2. 取消暂停状态标记
   * 3. 递归恢复所有子作用域
   * 4. 恢复当前作用域内的所有副作用
   */
  resume(): void {
    if (this._active) {
      if (this._isPaused) {
        // 取消暂停状态
        this._isPaused = false
        let i, l

        // 递归恢复所有子作用域
        if (this.scopes) {
          for (i = 0, l = this.scopes.length; i < l; i++) {
            this.scopes[i].resume()
          }
        }

        // 恢复当前作用域内的所有副作用
        for (i = 0, l = this.effects.length; i < l; i++) {
          this.effects[i].resume()
        }
      }
    }
  }

  /**
   * 在当前作用域的上下文中执行函数
   *
   * 这是 EffectScope 的核心方法，它会：
   * 1. 临时将当前作用域设置为活跃作用域
   * 2. 在此上下文中执行传入的函数
   * 3. 在函数执行期间创建的所有副作用都会被收集到当前作用域
   * 4. 执行完毕后恢复之前的活跃作用域
   *
   * @param fn 要执行的函数
   * @returns 函数的返回值，如果作用域不活跃则返回 undefined
   */
  run<T>(fn: () => T): T | undefined {
    if (this._active) {
      // 保存当前的活跃作用域
      const currentEffectScope = activeEffectScope
      try {
        // 将当前作用域设置为活跃作用域
        activeEffectScope = this
        // 执行函数，此时创建的副作用会被收集到当前作用域
        return fn()
      } finally {
        // 恢复之前的活跃作用域
        activeEffectScope = currentEffectScope
      }
    } else if (__DEV__) {
      // 开发环境下的警告：不能在非活跃的作用域中运行函数
      warn(`cannot run an inactive effect scope.`)
    }
  }

  /**
   * 保存激活前的作用域，用于在 off() 时恢复
   */
  prevScope: EffectScope | undefined

  /**
   * 激活当前作用域（引用计数方式）
   *
   * 此方法只应在非独立作用域上调用。
   * 使用引用计数机制，支持多次调用 on()，只有在第一次调用时才真正激活。
   *
   * 工作原理：
   * 1. 增加引用计数 _on
   * 2. 如果是第一次激活（_on === 1），则保存当前活跃作用域并设置自己为活跃作用域
   *
   * @internal
   */
  on(): void {
    if (++this._on === 1) {
      // 保存当前活跃的作用域
      this.prevScope = activeEffectScope
      // 将自己设置为活跃作用域
      activeEffectScope = this
    }
  }

  /**
   * 停用当前作用域（引用计数方式）
   *
   * 此方法只应在非独立作用域上调用。
   * 使用引用计数机制，只有当引用计数降为 0 时才真正停用。
   *
   * 工作原理：
   * 1. 减少引用计数 _on
   * 2. 如果引用计数降为 0，则恢复之前保存的活跃作用域
   *
   * @internal
   */
  off(): void {
    if (this._on > 0 && --this._on === 0) {
      // 恢复之前保存的活跃作用域
      activeEffectScope = this.prevScope
      // 清空保存的作用域引用
      this.prevScope = undefined
    }
  }

  /**
   * 停止作用域并清理所有相关资源
   *
   * 这是一个不可逆的操作，会彻底清理作用域及其所有子资源。
   * 执行顺序严格按照：副作用 → 清理回调 → 子作用域 → 父子关系
   *
   * 执行步骤：
   * 1. 停止所有副作用
   * 2. 执行所有清理回调
   * 3. 递归停止所有子作用域
   * 4. 从父作用域中移除自己（避免内存泄漏）
   * 5. 清理父子关系引用
   *
   * @param fromParent 是否由父作用域调用
   *                   - true: 由父作用域的 stop() 方法调用，无需从父作用域中移除自己
   *                   - false: 主动调用，需要从父作用域中移除自己
   */
  stop(fromParent?: boolean): void {
    if (this._active) {
      // 标记为非活跃状态
      this._active = false
      let i, l

      // 1. 停止所有副作用
      for (i = 0, l = this.effects.length; i < l; i++) {
        this.effects[i].stop()
      }
      this.effects.length = 0

      // 2. 执行所有清理回调函数
      for (i = 0, l = this.cleanups.length; i < l; i++) {
        this.cleanups[i]()
      }
      this.cleanups.length = 0

      // 3. 递归停止所有子作用域
      if (this.scopes) {
        for (i = 0, l = this.scopes.length; i < l; i++) {
          this.scopes[i].stop(true) // 传入 true 表示由父作用域调用
        }
        this.scopes.length = 0
      }

      // 4. 从父作用域中移除自己（避免内存泄漏）
      // 只有非独立作用域且不是由父作用域调用时才需要执行
      if (!this.detached && this.parent && !fromParent) {
        // 使用优化的 O(1) 移除算法
        // 将数组最后一个元素移动到当前位置，然后删除最后一个元素
        const last = this.parent.scopes!.pop()
        if (last && last !== this) {
          this.parent.scopes![this.index!] = last
          last.index = this.index!
        }
      }

      // 5. 清理父子关系引用
      this.parent = undefined
    }
  }
}

/**
 * Creates an effect scope object which can capture the reactive effects (i.e.
 * computed and watchers) created within it so that these effects can be
 * disposed together. For detailed use cases of this API, please consult its
 * corresponding {@link https://github.com/vuejs/rfcs/blob/master/active-rfcs/0041-reactivity-effect-scope.md | RFC}.
 *
 * @param detached - Can be used to create a "detached" effect scope.
 * @see {@link https://vuejs.org/api/reactivity-advanced.html#effectscope}
 */
export function effectScope(detached?: boolean): EffectScope {
  return new EffectScope(detached)
}

/**
 * Returns the current active effect scope if there is one.
 *
 * @see {@link https://vuejs.org/api/reactivity-advanced.html#getcurrentscope}
 */
export function getCurrentScope(): EffectScope | undefined {
  return activeEffectScope
}

/**
 * Registers a dispose callback on the current active effect scope. The
 * callback will be invoked when the associated effect scope is stopped.
 *
 * @param fn - The callback function to attach to the scope's cleanup.
 * @see {@link https://vuejs.org/api/reactivity-advanced.html#onscopedispose}
 */
export function onScopeDispose(fn: () => void, failSilently = false): void {
  if (activeEffectScope) {
    activeEffectScope.cleanups.push(fn)
  } else if (__DEV__ && !failSilently) {
    warn(
      `onScopeDispose() is called when there is no active effect scope` +
        ` to be associated with.`,
    )
  }
}
