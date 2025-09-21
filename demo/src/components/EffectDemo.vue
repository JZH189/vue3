<template>
  <div class="effect-demo">
    <h2>⚡ 副作用系统演示</h2>
    <p class="description">
      Vue
      3的effect系统是响应式的核心，它建立了响应式数据与副作用函数之间的依赖关系
    </p>

    <div class="demo-grid">
      <!-- 响应式数据控制 -->
      <div class="data-panel">
        <h3>📊 响应式数据</h3>
        <div class="data-controls">
          <div class="control-group">
            <label>计数器:</label>
            <div class="counter-controls">
              <button @click="decrementCounter" class="counter-btn">-</button>
              <span class="counter-value">{{ reactiveData.counter }}</span>
              <button @click="incrementCounter" class="counter-btn">+</button>
            </div>
          </div>

          <div class="control-group">
            <label>文本内容:</label>
            <input
              v-model="reactiveData.text"
              placeholder="输入文本内容"
              class="text-input"
            />
          </div>

          <div class="control-group">
            <label>状态开关:</label>
            <button
              @click="toggleStatus"
              :class="['toggle-btn', { active: reactiveData.isActive }]"
            >
              {{ reactiveData.isActive ? '开启' : '关闭' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Effect 管理 -->
      <div class="effect-panel">
        <h3>🔄 Effect 管理</h3>
        <div class="effect-controls">
          <button @click="createNewEffect" class="create-btn">
            创建新Effect
          </button>
          <button @click="removeAllEffects" class="remove-all-btn">
            移除所有Effect
          </button>
        </div>

        <div class="effect-list">
          <div v-for="effect in effects" :key="effect.id" class="effect-item">
            <div class="effect-header">
              <span class="effect-id">Effect #{{ effect.id }}</span>
              <div class="effect-actions">
                <button
                  @click="toggleEffect(effect.id)"
                  :class="['toggle-effect-btn', { active: effect.active }]"
                >
                  {{ effect.active ? '暂停' : '启动' }}
                </button>
                <button @click="removeEffect(effect.id)" class="remove-btn">
                  删除
                </button>
              </div>
            </div>
            <div class="effect-stats">
              <span>执行次数: {{ effect.runCount }}</span>
              <span>上次执行: {{ effect.lastRun || '从未执行' }}</span>
            </div>
            <div class="effect-description">
              {{ effect.description }}
            </div>
          </div>
        </div>
      </div>

      <!-- 执行日志 -->
      <div class="log-panel">
        <h3>📝 执行日志</h3>
        <div class="log-controls">
          <button @click="clearLogs" class="clear-btn">清空日志</button>
          <label class="auto-scroll-label">
            <input type="checkbox" v-model="autoScroll" />
            自动滚动
          </label>
        </div>
        <div class="log-container" ref="logContainer">
          <div
            v-for="log in logs"
            :key="log.id"
            :class="['log-entry', log.type]"
          >
            <span class="log-time">{{ log.time }}</span>
            <span class="log-effect">Effect #{{ log.effectId }}</span>
            <span class="log-message">{{ log.message }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- activeSub 状态显示 -->
    <div class="active-sub-panel">
      <h3>🎯 当前活跃订阅者状态</h3>
      <div class="active-sub-display">
        <div class="status-item">
          <span class="label">activeSub:</span>
          <span class="value">{{ activeSubInfo.current || 'undefined' }}</span>
        </div>
        <div class="status-item">
          <span class="label">shouldTrack:</span>
          <span class="value">{{ activeSubInfo.shouldTrack }}</span>
        </div>
        <div class="status-item">
          <span class="label">依赖收集状态:</span>
          <span
            :class="[
              'value',
              activeSubInfo.isTracking ? 'tracking' : 'not-tracking',
            ]"
          >
            {{ activeSubInfo.isTracking ? '正在收集' : '未收集' }}
          </span>
        </div>
      </div>
    </div>

    <!-- 原理说明 -->
    <div class="explanation">
      <h3>🔬 Effect系统原理</h3>
      <div class="principle-grid">
        <div class="principle-item">
          <h4>1. Effect创建与执行</h4>
          <p>
            Effect是响应式系统的核心，它会立即执行一次，并在依赖变化时重新执行
          </p>
          <pre><code>function effect(fn) {
  const effectFn = () => {
    // 设置当前活跃的effect
    activeEffect = effectFn
    // 执行用户函数，触发依赖收集
    fn()
    // 清除活跃effect
    activeEffect = null
  }
  
  effectFn()
  return effectFn
}</code></pre>
        </div>

        <div class="principle-item">
          <h4>2. 依赖收集机制</h4>
          <p>在effect执行过程中，访问响应式数据会触发依赖收集</p>
          <pre><code>// 在响应式对象的get拦截器中
function track(target, key) {
  if (activeEffect) {
    let depsMap = targetMap.get(target)
    if (!depsMap) {
      targetMap.set(target, depsMap = new Map())
    }
    let dep = depsMap.get(key)
    if (!dep) {
      depsMap.set(key, dep = new Set())
    }
    dep.add(activeEffect)
    activeEffect.deps.add(dep)
  }
}</code></pre>
        </div>

        <div class="principle-item">
          <h4>3. 依赖更新触发</h4>
          <p>当响应式数据变化时，会触发相关的所有effect重新执行</p>
          <pre><code>function trigger(target, key) {
  const depsMap = targetMap.get(target)
  if (!depsMap) return
  
  const dep = depsMap.get(key)
  if (dep) {
    // 创建新的Set避免无限循环
    const effects = new Set(dep)
    effects.forEach(effect => effect())
  }
}</code></pre>
        </div>

        <div class="principle-item">
          <h4>4. activeSub机制</h4>
          <p>Vue 3使用activeSub跟踪当前正在执行的订阅者，实现精确的依赖收集</p>
          <pre><code>// 在ReactiveEffect.run()中
run() {
  if (!(this.flags & EffectFlags.ACTIVE)) {
    return this.fn()
  }
  
  const prevSub = activeSub
  activeSub = this
  shouldTrack = true
  
  try {
    return this.fn()
  } finally {
    activeSub = prevSub
    shouldTrack = prevShouldTrack
  }
}</code></pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, effect, stop, nextTick } from 'vue'

interface EffectItem {
  id: number
  fn: () => void
  runner: any
  active: boolean
  runCount: number
  lastRun: string | null
  description: string
}

interface LogEntry {
  id: number
  time: string
  effectId: number
  message: string
  type: 'create' | 'run' | 'stop' | 'trigger'
}

// 响应式数据
const reactiveData = reactive({
  counter: 0,
  text: 'Hello Vue 3',
  isActive: true,
})

// Effect管理
const effects = ref<EffectItem[]>([])
const logs = ref<LogEntry[]>([])
const autoScroll = ref(true)
const logContainer = ref<HTMLElement>()

let effectIdCounter = 1
let logIdCounter = 1

// 模拟activeSub状态
const activeSubInfo = reactive({
  current: null as string | null,
  shouldTrack: true,
  isTracking: false,
})

// 创建新Effect
function createNewEffect() {
  const effectId = effectIdCounter++

  const effectItem: EffectItem = {
    id: effectId,
    fn: () => {},
    runner: null,
    active: true,
    runCount: 0,
    lastRun: null,
    description: generateEffectDescription(effectId),
  }

  // 创建effect函数
  const effectFn = () => {
    if (!effectItem.active) return

    effectItem.runCount++
    effectItem.lastRun = new Date().toLocaleTimeString()

    // 模拟activeSub状态变化
    activeSubInfo.current = `ReactiveEffect(${effectId})`
    activeSubInfo.isTracking = true

    addLog(effectId, `Effect #${effectId} 开始执行`, 'run')

    // 访问响应式数据（触发依赖收集）
    const counterValue = reactiveData.counter
    const textValue = reactiveData.text
    const isActiveValue = reactiveData.isActive

    addLog(
      effectId,
      `访问数据: counter=${counterValue}, text="${textValue}", isActive=${isActiveValue}`,
      'run',
    )

    // 模拟effect执行完成
    setTimeout(() => {
      activeSubInfo.current = null
      activeSubInfo.isTracking = false
      addLog(effectId, `Effect #${effectId} 执行完成`, 'run')
    }, 100)
  }

  // 创建Vue的effect
  const runner = effect(effectFn)
  effectItem.runner = runner
  effectItem.fn = effectFn

  effects.value.push(effectItem)
  addLog(effectId, `Effect #${effectId} 已创建`, 'create')
}

// 生成Effect描述
function generateEffectDescription(id: number): string {
  const descriptions = [
    `监听计数器变化并更新UI`,
    `根据文本内容执行相应操作`,
    `根据状态开关控制显示`,
    `计算并缓存复杂表达式`,
    `监听多个数据源的组合变化`,
  ]
  return descriptions[(id - 1) % descriptions.length]
}

// 切换Effect状态
function toggleEffect(effectId: number) {
  const effectItem = effects.value.find(e => e.id === effectId)
  if (effectItem) {
    effectItem.active = !effectItem.active
    const action = effectItem.active ? '启动' : '暂停'
    addLog(effectId, `Effect #${effectId} 已${action}`, 'stop')
  }
}

// 移除单个Effect
function removeEffect(effectId: number) {
  const index = effects.value.findIndex(e => e.id === effectId)
  if (index > -1) {
    const effectItem = effects.value[index]
    if (effectItem.runner) {
      stop(effectItem.runner)
    }
    effects.value.splice(index, 1)
    addLog(effectId, `Effect #${effectId} 已删除`, 'stop')
  }
}

// 移除所有Effects
function removeAllEffects() {
  effects.value.forEach(effectItem => {
    if (effectItem.runner) {
      stop(effectItem.runner)
    }
  })
  effects.value = []
  addLog(0, '所有Effect已删除', 'stop')
}

// 数据操作方法
function incrementCounter() {
  reactiveData.counter++
  addLog(0, `计数器增加: ${reactiveData.counter}`, 'trigger')
}

function decrementCounter() {
  reactiveData.counter--
  addLog(0, `计数器减少: ${reactiveData.counter}`, 'trigger')
}

function toggleStatus() {
  reactiveData.isActive = !reactiveData.isActive
  addLog(0, `状态切换: ${reactiveData.isActive}`, 'trigger')
}

// 日志管理
function addLog(effectId: number, message: string, type: LogEntry['type']) {
  logs.value.push({
    id: logIdCounter++,
    time: new Date().toLocaleTimeString(),
    effectId,
    message,
    type,
  })

  if (autoScroll.value) {
    nextTick(() => {
      if (logContainer.value) {
        logContainer.value.scrollTop = logContainer.value.scrollHeight
      }
    })
  }
}

function clearLogs() {
  logs.value = []
}

// 初始化一些Effect
setTimeout(() => {
  createNewEffect()
  createNewEffect()
}, 500)
</script>

<style scoped>
.effect-demo {
  padding: 1rem;
}

.description {
  color: #666;
  margin-bottom: 2rem;
  font-size: 1.1rem;
  line-height: 1.6;
}

.demo-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.data-panel,
.effect-panel,
.log-panel {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.data-panel h3,
.effect-panel h3,
.log-panel h3 {
  margin-bottom: 1rem;
  color: #333;
  font-size: 1.2rem;
}

.control-group {
  margin-bottom: 1.5rem;
}

.control-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #555;
}

.counter-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.counter-btn {
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  background: #42b883;
  color: white;
  font-size: 1.2rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;
}

.counter-btn:hover {
  background: #369870;
  transform: scale(1.1);
}

.counter-value {
  font-size: 1.5rem;
  font-weight: bold;
  color: #333;
  min-width: 40px;
  text-align: center;
}

.text-input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 1rem;
}

.toggle-btn {
  padding: 0.5rem 1rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1rem;
  background: #f8f9fa;
  color: #666;
  transition: all 0.3s ease;
}

.toggle-btn.active {
  background: #42b883;
  color: white;
  border-color: #42b883;
}

.effect-controls {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
}

.create-btn {
  background: #42b883;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.3s ease;
}

.create-btn:hover {
  background: #369870;
}

.remove-all-btn {
  background: #e74c3c;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.3s ease;
}

.remove-all-btn:hover {
  background: #c0392b;
}

.effect-list {
  max-height: 400px;
  overflow-y: auto;
}

.effect-item {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
  border: 1px solid #e0e0e0;
}

.effect-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.effect-id {
  font-weight: bold;
  color: #333;
}

.effect-actions {
  display: flex;
  gap: 0.5rem;
}

.toggle-effect-btn {
  padding: 0.25rem 0.5rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
  background: #6c757d;
  color: white;
  transition: all 0.3s ease;
}

.toggle-effect-btn.active {
  background: #28a745;
}

.remove-btn {
  padding: 0.25rem 0.5rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
  background: #dc3545;
  color: white;
  transition: all 0.3s ease;
}

.effect-stats {
  font-size: 0.8rem;
  color: #666;
  margin-bottom: 0.5rem;
  display: flex;
  gap: 1rem;
}

.effect-description {
  font-size: 0.9rem;
  color: #555;
  font-style: italic;
}

.log-controls {
  display: flex;
  align-items: center;
  margin-bottom: 1rem;
  gap: 1rem;
}

.clear-btn {
  background: #e74c3c;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
}

.auto-scroll-label {
  font-size: 0.9rem;
  color: #666;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.log-container {
  height: 300px;
  overflow-y: auto;
  background: #1a1a1a;
  color: #f0f0f0;
  padding: 1rem;
  border-radius: 8px;
  font-family: 'Monaco', 'Consolas', monospace;
  font-size: 0.8rem;
}

.log-entry {
  padding: 0.25rem 0;
  border-bottom: 1px solid #333;
  display: grid;
  grid-template-columns: 80px 100px 1fr;
  gap: 0.5rem;
}

.log-entry.create {
  color: #4ade80;
}

.log-entry.run {
  color: #06b6d4;
}

.log-entry.stop {
  color: #f59e0b;
}

.log-entry.trigger {
  color: #ef4444;
}

.log-time {
  color: #888;
  font-size: 0.7rem;
}

.log-effect {
  font-weight: bold;
}

.active-sub-panel {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  margin-bottom: 2rem;
}

.active-sub-panel h3 {
  margin-bottom: 1rem;
  color: #333;
  font-size: 1.2rem;
}

.active-sub-display {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.status-item {
  background: #f8f9fa;
  padding: 1rem;
  border-radius: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.status-item .label {
  font-weight: 600;
  color: #555;
}

.status-item .value {
  font-family: 'Monaco', 'Consolas', monospace;
  background: white;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  border: 1px solid #e0e0e0;
}

.status-item .value.tracking {
  background: #d4edda;
  border-color: #c3e6cb;
  color: #155724;
}

.status-item .value.not-tracking {
  background: #f8d7da;
  border-color: #f5c6cb;
  color: #721c24;
}

.explanation {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.explanation h3 {
  margin-bottom: 1.5rem;
  color: #333;
  font-size: 1.3rem;
}

.principle-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 1.5rem;
}

.principle-item {
  background: #f8f9fa;
  padding: 1.5rem;
  border-radius: 8px;
  border-left: 4px solid #42b883;
}

.principle-item h4 {
  margin-bottom: 0.5rem;
  color: #333;
}

.principle-item p {
  margin-bottom: 1rem;
  color: #666;
  line-height: 1.5;
}

.principle-item pre {
  background: #1a1a1a;
  color: #f0f0f0;
  padding: 1rem;
  border-radius: 6px;
  overflow-x: auto;
  font-size: 0.8rem;
  line-height: 1.4;
}

.principle-item code {
  font-family: 'Monaco', 'Consolas', monospace;
}

@media (max-width: 1024px) {
  .demo-grid {
    grid-template-columns: 1fr;
  }

  .principle-grid {
    grid-template-columns: 1fr;
  }

  .active-sub-display {
    grid-template-columns: 1fr;
  }
}
</style>
