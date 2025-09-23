# Vue 3 响应式系统详细调用流程图

## 1. 响应式对象创建流程

```mermaid
flowchart TD
    A["用户调用 reactive(obj)"] --> A1{"检查是否readonly"}
    A1 -->|"是readonly"| A2["返回target本身"]
    A1 -->|"不是readonly"| B["createReactiveObject"]

    B --> C{"检查对象类型"}
    C -->|"非对象"| D["返回原值并警告"]
    C -->|"已是代理"| E{"检查代理类型"}

    E -->|"target[RAW]存在且条件满足"| F["返回现有代理"]
    E -->|"不满足条件"| G["获取目标类型getTargetType"]
    C -->|"普通有效对象"| G

    G --> H{"目标类型判断"}
    H -->|"INVALID"| I["返回原值"]
    H -->|"COLLECTION"| J["检查proxyMap缓存"]
    H -->|"COMMON"| J

    J --> K{"缓存中是否存在"}
    K -->|"存在"| L["返回缓存的代理"]
    K -->|"不存在"| M{"选择Handler"}

    M -->|"COLLECTION类型"| N["使用collectionHandlers"]
    M -->|"COMMON类型"| O["使用baseHandlers/mutableHandlers"]

    N --> P["new Proxy with collectionHandlers"]
    O --> Q["new Proxy with mutableHandlers"]

    P --> R["缓存到 proxyMap"]
    Q --> R
    R --> S["返回响应式代理"]

    style A fill:#e1f5fe
    style S fill:#c8e6c9
    style D fill:#ffcdd2
    style I fill:#ffcdd2
```

## 2. 属性访问与依赖收集流程

```mermaid
flowchart TD
    A[访问 proxy.property] --> B[MutableReactiveHandler.get]
    B --> C{检查特殊标志}
    C -->|ReactiveFlags| D[返回标志值]
    C -->|普通属性| E[Reflect.get获取值]

    E --> F{readonly检查}
    F -->|readonly| G[直接返回值]
    F -->|可写| H[调用 track]

    H --> I[track函数执行]
    I --> J{三重安全检查}
    J -->|检查失败| K[不收集依赖]
    J -->|检查通过| L[获取targetMap]

    L --> M[获取或创建 depsMap]
    M --> N[获取或创建 Dep]
    N --> O[dep.track执行]

    O --> P{Link存在检查}
    P -->|不存在| Q[创建新Link]
    P -->|存在但过期| R[复用Link并更新版本]
    P -->|存在且有效| S[使用现有Link]

    Q --> T[addSub添加订阅者]
    R --> T
    S --> U[返回属性值]
    T --> U

    style A fill:#e1f5fe
    style U fill:#c8e6c9
```

## 3. 属性修改与响应式更新流程

```mermaid
flowchart TD
    A[设置 proxy.property = value] --> B[MutableReactiveHandler.set]
    B --> C[获取旧值 oldValue]
    C --> D[Reflect.set设置新值]
    D --> E{值是否改变}

    E -->|未改变| F[返回成功]
    E -->|已改变| G[调用 trigger]

    G --> H[trigger函数执行]
    H --> I[获取 depsMap]
    I --> J{depsMap存在}
    J -->|不存在| K[更新globalVersion]
    J -->|存在| L[startBatch开始批处理]

    L --> M[获取对应的 Dep]
    M --> N[dep.trigger执行]
    N --> O[版本号递增]
    O --> P[dep.notify通知订阅者]

    P --> Q[遍历订阅者链表]
    Q --> R[调用 subscriber.notify]
    R --> S{subscriber类型}

    S -->|ReactiveEffect| T[batch加入队列]
    S -->|ComputedRef| U[标记DIRTY + batch]

    T --> V[endBatch批量执行]
    U --> V
    V --> W[执行所有effects]
    W --> X[完成更新]

    style A fill:#ffecb3
    style X fill:#c8e6c9
```

## 4. Effect 执行流程

```mermaid
flowchart TD
    A[effect函数调用] --> B[创建ReactiveEffect]
    B --> C[effect.run执行]
    C --> D{ACTIVE检查}
    D -->|未激活| E[直接执行fn]
    D -->|已激活| F[设置RUNNING标志]

    F --> G[cleanupEffect清理]
    G --> H[prepareDeps准备依赖]
    H --> I[设置 activeSub = this]
    I --> J[设置 shouldTrack = true]

    J --> K[执行用户函数 fn]
    K --> L[函数内访问响应式数据]
    L --> M[触发依赖收集]
    M --> N[函数执行完成]

    N --> O[cleanupDeps清理无用依赖]
    O --> P[恢复 activeSub]
    P --> Q[恢复 shouldTrack]
    Q --> R[清除RUNNING标志]
    R --> S[返回执行结果]

    style A fill:#e1f5fe
    style S fill:#c8e6c9
```

## 5. Computed 计算流程

```mermaid
flowchart TD
    A[访问 computed.value] --> B[ComputedRef.get]
    B --> C[dep.track建立依赖]
    C --> D[refreshComputed执行]
    D --> E{全局版本检查}

    E -->|版本一致| F[返回缓存值]
    E -->|版本不一致| G{DIRTY检查}

    G -->|不脏| H[返回当前值]
    G -->|脏数据| I[isDirty深度检查]

    I --> J{依赖是否变化}
    J -->|未变化| K[返回当前值]
    J -->|已变化| L[设置RUNNING标志]

    L --> M[设置 activeSub = computed]
    M --> N[prepareDeps准备依赖]
    N --> O[执行 getter 函数]

    O --> P[收集新的依赖]
    P --> Q[获得计算结果]
    Q --> R{值是否改变}

    R -->|未改变| S[不更新版本]
    R -->|已改变| T[更新 _value 和版本]

    S --> U[cleanupDeps清理]
    T --> U
    U --> V[恢复 activeSub]
    V --> W[清除RUNNING标志]
    W --> X[返回计算值]

    style A fill:#fff3e0
    style X fill:#c8e6c9
```

## 6. 批处理机制详细流程

```mermaid
flowchart TD
    A[响应式数据变化] --> B[trigger触发]
    B --> C[startBatch计数+1]
    C --> D[dep.notify通知订阅者]

    D --> E[遍历订阅者链表]
    E --> F[subscriber.notify]
    F --> G{已通知检查}

    G -->|已通知| H[跳过重复通知]
    G -->|未通知| I[设置NOTIFIED标志]

    I --> J{订阅者类型}
    J -->|普通Effect| K[加入batchedSub队列]
    J -->|Computed| L[加入batchedComputed队列]

    K --> M[等待批处理执行]
    L --> M
    M --> N[endBatch计数-1]

    N --> O{批处理深度检查}
    O -->|深度>0| P[继续等待]
    O -->|深度=0| Q[开始执行批次]

    Q --> R[处理batchedComputed]
    R --> S[清除computed的NOTIFIED标志]
    S --> T[处理batchedSub]

    T --> U[遍历effect队列]
    U --> V[检查ACTIVE标志]
    V --> W[调用effect.trigger]
    W --> X{有调度器}

    X -->|有调度器| Y[使用scheduler执行]
    X -->|无调度器| Z[直接runIfDirty]

    Y --> AA[完成单个effect]
    Z --> AA
    AA --> BB[处理下一个effect]
    BB --> CC[批处理完成]

    style A fill:#ffecb3
    style CC fill:#c8e6c9
```

## 7. 依赖清理机制流程

```mermaid
flowchart TD
    A[effect.run开始] --> B[prepareDeps预处理]
    B --> C[遍历所有deps链接]
    C --> D[设置link.version = -1]
    D --> E[保存link.prevActiveLink]
    E --> F[设置dep.activeLink = link]

    F --> G[执行用户函数]
    G --> H[访问响应式数据触发track]
    H --> I[更新使用的link.version]
    I --> J[函数执行完成]

    J --> K[cleanupDeps清理]
    K --> L[从depsTail开始遍历]
    L --> M{检查link.version}

    M -->|version = -1| N[标记为无用依赖]
    M -->|version ≥ 0| O[标记为有用依赖]

    N --> P[removeSub从依赖中移除]
    P --> Q[removeDep从effect中移除]
    Q --> R[处理下一个link]

    O --> S[保留link]
    S --> R

    R --> T{还有link}
    T -->|有| L
    T -->|无| U[重建依赖链表]

    U --> V[设置新的头尾指针]
    V --> W[恢复activeLink]
    W --> X[清理完成]

    style A fill:#e8f5e8
    style X fill:#c8e6c9
```

## 8. 内存管理流程

```mermaid
flowchart TD
    A[对象被垃圾回收] --> B[WeakMap自动清理]
    B --> C[targetMap条目消失]
    C --> D[depsMap变为不可达]
    D --> E[Dep对象标记清理]

    F[订阅者计数为0] --> G[dep.sc === 0检查]
    G --> H[从depsMap中删除]
    H --> I[Dep对象可被回收]

    J[effect.stop调用] --> K[遍历所有deps]
    K --> L[调用removeSub]
    L --> M[减少订阅者计数]
    M --> N[清空deps链表]
    N --> O[清理cleanup函数]
    O --> P[设置ACTIVE=false]

    Q[computed无订阅者] --> R[清除TRACKING标志]
    R --> S[递归清理computed依赖]
    S --> T[computed进入休眠状态]

    style A fill:#ffcdd2
    style I fill:#c8e6c9
    style P fill:#c8e6c9
    style T fill:#c8e6c9
```

## 9. 完整的响应式更新生命周期

```mermaid
sequenceDiagram
    participant User as 用户代码
    participant Proxy as 响应式代理
    participant Handler as Handler
    participant Dep as Dep
    participant Effect as ReactiveEffect
    participant Scheduler as 调度器
    participant DOM as DOM更新

    Note over User,DOM: 1. 初始化阶段
    User->>Proxy: reactive(data)
    Proxy->>Handler: 创建代理处理器

    User->>Effect: effect(() => render())
    Effect->>Effect: 执行render函数
    Effect->>Proxy: 访问响应式数据
    Proxy->>Handler: 拦截get操作
    Handler->>Dep: track建立依赖
    Dep->>Effect: 添加到订阅者列表

    Note over User,DOM: 2. 响应式更新阶段
    User->>Proxy: data.count = 10
    Proxy->>Handler: 拦截set操作
    Handler->>Dep: trigger通知变化
    Dep->>Dep: 版本号递增

    Dep->>Effect: notify通知订阅者
    Effect->>Scheduler: 加入批处理队列

    Note over User,DOM: 3. 批处理执行阶段
    Scheduler->>Scheduler: startBatch()
    Scheduler->>Effect: 批量执行effects
    Effect->>Effect: run()重新执行
    Effect->>DOM: 更新DOM
    Scheduler->>Scheduler: endBatch()

    Note over User,DOM: 4. 清理阶段
    Effect->>Dep: 清理无用依赖
    Dep->>Dep: 更新订阅者列表
```

## 10. 性能优化检查点

### 10.1 依赖收集优化检查点

```typescript
// 检查点1: 三重安全检查
if (!activeSub || !shouldTrack || activeSub === this.computed) {
  return // 避免无效的依赖收集
}

// 检查点2: Link复用
if (link === undefined || link.sub !== activeSub) {
  // 创建新Link的代价相对较高
  link = this.activeLink = new Link(activeSub, this)
} else if (link.version === -1) {
  // 复用现有Link，性能最优
  link.version = this.version
}

// 检查点3: LRU优化
if (link.nextDep) {
  // 将最近使用的依赖移到链表尾部
  // 提高后续访问的缓存命中率
}
```

### 10.2 批处理优化检查点

```typescript
// 检查点1: 防止重复通知
if (!(this.flags & EffectFlags.NOTIFIED)) {
  batch(this) // 只有未通知的effect才加入队列
}

// 检查点2: 分类批处理
if (isComputed) {
  sub.next = batchedComputed // computed优先处理
} else {
  sub.next = batchedSub // 普通effect后处理
}

// 检查点3: 错误隔离
try {
  effect.trigger()
} catch (err) {
  if (!error) error = err // 收集第一个错误
}
```

### 10.3 内存优化检查点

```typescript
// 检查点1: 自动清理
if (!--dep.sc && dep.map) {
  dep.map.delete(dep.key) // 订阅者为0时清理
}

// 检查点2: WeakMap使用
const targetMap: WeakMap<object, KeyToDepMap> = new WeakMap()
// 原始对象回收时自动清理相关依赖

// 检查点3: 循环引用避免
if (activeSub === this.computed) {
  return // 防止computed自引用
}
```

这些流程图和检查点展示了 Vue 3 响应式系统是如何通过精心设计的算法和优化策略，在保证功能完整性的同时实现高性能的响应式编程的。
