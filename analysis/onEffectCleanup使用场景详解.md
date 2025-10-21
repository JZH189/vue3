# onEffectCleanup 使用场景详解

## 1. 概述

`onEffectCleanup` 是 Vue 3 响应式系统中的一个重要函数，用于为当前活跃的副作用注册清理函数。这些清理函数会在副作用重新执行前或副作用停止时被调用，主要用于清理副作用产生的资源，防止内存泄漏和其他副作用。

## 2. 使用场景详解

### 2.1 清理定时器（setTimeout, setInterval）

在 Vue 组件或响应式副作用中，我们经常需要使用定时器来执行一些延迟或周期性任务。如果不正确清理这些定时器，可能会导致以下问题：

- 内存泄漏
- 不必要的计算消耗
- 组件卸载后仍然执行代码导致错误

```javascript
import { ref, watchEffect } from 'vue'

export default {
  setup() {
    const count = ref(0)
    const timerId = ref(null)

    // 使用 watchEffect 监听 count 变化并设置定时器
    watchEffect(onCleanup => {
      console.log('当前计数:', count.value)

      // 设置一个定时器
      timerId.value = setTimeout(() => {
        console.log('定时器执行')
      }, 1000)

      // 注册清理函数，在下次 watchEffect 执行前或停止时清理定时器
      onCleanup(() => {
        if (timerId.value) {
          clearTimeout(timerId.value)
          console.log('定时器已清理')
        }
      })
    })

    // 每2秒增加计数
    setInterval(() => {
      count.value++
    }, 2000)

    return { count }
  },
}
```

在上面的例子中，每次 `count` 变化时，`watchEffect` 都会重新执行。在重新执行之前，之前注册的清理函数会被调用，清理掉之前的定时器，然后设置新的定时器。

### 2.2 取消网络请求

在现代 Web 应用中，网络请求是常见的操作。当组件状态变化时，可能需要发起新的请求并取消之前的请求，以避免竞态条件和不必要的网络消耗。

```javascript
import { ref, watchEffect } from 'vue'

export default {
  setup() {
    const userId = ref(1)
    const userData = ref(null)

    watchEffect(onCleanup => {
      // 创建一个 AbortController 来控制请求取消
      const controller = new AbortController()
      const { signal } = controller

      // 发起网络请求
      fetch(`/api/users/${userId.value}`, { signal })
        .then(response => response.json())
        .then(data => {
          userData.value = data
        })
        .catch(error => {
          // 忽略取消请求导致的错误
          if (error.name !== 'AbortError') {
            console.error('请求失败:', error)
          }
        })

      // 注册清理函数，用于取消请求
      onCleanup(() => {
        controller.abort()
        console.log('请求已取消')
      })
    })

    // 模拟用户ID变化
    const changeUser = () => {
      userId.value = userId.value + 1
    }

    return { userData, changeUser }
  },
}
```

在这个例子中，当 `userId` 变化时，会发起新的请求并取消之前的请求，避免了竞态条件。

### 2.3 解绑事件监听器

在 Vue 组件中，我们有时需要直接操作 DOM 元素并添加事件监听器。为了防止内存泄漏，需要在适当的时机移除这些监听器。

```javascript
import { ref, watchEffect } from 'vue'

export default {
  setup() {
    const isVisible = ref(true)
    const buttonRef = ref(null)

    watchEffect(onCleanup => {
      if (isVisible.value && buttonRef.value) {
        const handleClick = () => {
          console.log('按钮被点击')
        }

        // 添加事件监听器
        buttonRef.value.addEventListener('click', handleClick)

        // 注册清理函数，用于移除事件监听器
        onCleanup(() => {
          buttonRef.value.removeEventListener('click', handleClick)
          console.log('事件监听器已移除')
        })
      }
    })

    const toggleVisibility = () => {
      isVisible.value = !isVisible.value
    }

    return { isVisible, buttonRef, toggleVisibility }
  },
}
```

在这个例子中，当 `isVisible` 变化时，会根据状态添加或移除事件监听器，确保不会产生内存泄漏。

### 2.4 关闭 WebSocket 连接

WebSocket 是实现服务器推送技术的重要手段，但在组件销毁或状态变化时，需要正确关闭连接以释放资源。

```javascript
import { ref, watchEffect } from 'vue'

export default {
  setup() {
    const isConnected = ref(false)
    const websocket = ref(null)
    const messages = ref([])

    watchEffect(onCleanup => {
      if (isConnected.value) {
        // 创建 WebSocket 连接
        websocket.value = new WebSocket('ws://localhost:8080')

        websocket.value.onmessage = event => {
          messages.value.push(event.data)
        }

        websocket.value.onopen = () => {
          console.log('WebSocket 连接已建立')
        }

        websocket.value.onclose = () => {
          console.log('WebSocket 连接已关闭')
        }

        // 注册清理函数，用于关闭 WebSocket 连接
        onCleanup(() => {
          if (websocket.value) {
            websocket.value.close()
            websocket.value = null
            console.log('WebSocket 连接已关闭')
          }
        })
      }
    })

    const toggleConnection = () => {
      isConnected.value = !isConnected.value
    }

    return { isConnected, messages, toggleConnection }
  },
}
```

在这个例子中，当 `isConnected` 状态变化时，会建立或关闭 WebSocket 连接，确保资源得到正确管理。

### 2.5 清理其他副作用资源

除了上述常见场景外，还有许多其他需要清理的副作用资源：

```javascript
import { ref, watchEffect } from 'vue'

export default {
  setup() {
    const isObserving = ref(false)
    const targetElement = ref(null)

    watchEffect(onCleanup => {
      if (isObserving.value && targetElement.value) {
        // 使用 ResizeObserver 监听元素大小变化
        const resizeObserver = new ResizeObserver(entries => {
          console.log('元素大小变化:', entries[0].contentRect)
        })

        resizeObserver.observe(targetElement.value)

        // 使用 IntersectionObserver 监听元素可见性变化
        const intersectionObserver = new IntersectionObserver(entries => {
          console.log('元素可见性变化:', entries[0].isIntersecting)
        })

        intersectionObserver.observe(targetElement.value)

        // 使用 MutationObserver 监听元素属性变化
        const mutationObserver = new MutationObserver(mutations => {
          console.log('元素属性变化:', mutations)
        })

        mutationObserver.observe(targetElement.value, {
          attributes: true,
          childList: true,
          subtree: true,
        })

        // 注册清理函数，用于断开所有观察器
        onCleanup(() => {
          resizeObserver.disconnect()
          intersectionObserver.disconnect()
          mutationObserver.disconnect()
          console.log('所有观察器已断开')
        })
      }
    })

    const toggleObserving = () => {
      isObserving.value = !isObserving.value
    }

    return { isObserving, targetElement, toggleObserving }
  },
}
```

## 3. 总结

`onEffectCleanup` 函数提供了一种优雅的资源管理机制，确保在副作用重新执行或停止时能够正确清理资源。这不仅防止了内存泄漏，还提高了应用的性能和稳定性。

使用 `onEffectCleanup` 的关键点：

1. 在副作用函数中注册清理函数
2. 清理函数会在适当的时候自动调用
3. 避免手动管理资源的复杂性
4. 确保应用的健壮性和性能
