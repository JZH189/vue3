<template>
  <div class="computed-demo">
    <h2>🧮 计算属性演示</h2>
    <p class="description">
      计算属性是Vue 3响应式系统的重要组成部分，它具有缓存机制和懒计算特性
    </p>

    <div class="demo-grid">
      <!-- 基础数据控制 -->
      <div class="data-panel">
        <h3>📊 基础响应式数据</h3>
        <div class="data-controls">
          <div class="control-group">
            <label>数字A:</label>
            <input
              type="number"
              v-model.number="baseData.a"
              class="number-input"
            />
          </div>

          <div class="control-group">
            <label>数字B:</label>
            <input
              type="number"
              v-model.number="baseData.b"
              class="number-input"
            />
          </div>

          <div class="control-group">
            <label>文本:</label>
            <input
              v-model="baseData.text"
              placeholder="输入文本"
              class="text-input"
            />
          </div>

          <div class="control-group">
            <label>列表项:</label>
            <div class="list-controls">
              <input
                v-model="newItem"
                @keyup.enter="addItem"
                placeholder="添加新项目"
                class="text-input"
              />
              <button @click="addItem" class="add-btn">添加</button>
            </div>
            <div class="items-list">
              <div
                v-for="(item, index) in baseData.items"
                :key="index"
                class="item-tag"
              >
                {{ item }}
                <button @click="removeItem(index)" class="remove-item">
                  ×
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 计算属性状态 -->
      <div class="computed-panel">
        <h3>🧮 计算属性状态</h3>
        <div class="computed-list">
          <div
            v-for="computed in computedList"
            :key="computed.name"
            class="computed-item"
          >
            <div class="computed-header">
              <span class="computed-name">{{ computed.name }}</span>
              <div class="computed-stats">
                <span class="compute-count"
                  >计算次数: {{ computed.computeCount }}</span
                >
                <span :class="['cached-status', { cached: computed.isCached }]">
                  {{ computed.isCached ? '已缓存' : '需计算' }}
                </span>
              </div>
            </div>
            <div class="computed-value">值: {{ computed.value }}</div>
            <div class="computed-deps">
              依赖: {{ computed.dependencies.join(', ') }}
            </div>
            <div class="computed-desc">
              {{ computed.description }}
            </div>
          </div>
        </div>
      </div>

      <!-- 执行日志 -->
      <div class="log-panel">
        <h3>📝 计算日志</h3>
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
            <span class="log-computed">{{ log.computedName }}</span>
            <span class="log-message">{{ log.message }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 实际计算属性值显示 -->
    <div class="values-panel">
      <h3>💎 实际计算属性值</h3>
      <div class="values-grid">
        <div class="value-item">
          <span class="value-label">sum (a + b):</span>
          <span class="value-result">{{ sum }}</span>
        </div>
        <div class="value-item">
          <span class="value-label">product (a × b):</span>
          <span class="value-result">{{ product }}</span>
        </div>
        <div class="value-item">
          <span class="value-label">textLength:</span>
          <span class="value-result">{{ textLength }}</span>
        </div>
        <div class="value-item">
          <span class="value-label">itemsCount:</span>
          <span class="value-result">{{ itemsCount }}</span>
        </div>
        <div class="value-item">
          <span class="value-label">complexCalculation:</span>
          <span class="value-result">{{ complexCalculation }}</span>
        </div>
        <div class="value-item">
          <span class="value-label">expensiveOperation:</span>
          <span class="value-result">{{ expensiveOperation }}</span>
        </div>
      </div>
    </div>

    <!-- 懒计算演示 -->
    <div class="lazy-demo-panel">
      <h3>⏰ 懒计算演示</h3>
      <div class="lazy-controls">
        <button
          @click="toggleLazyComputed"
          :class="['toggle-btn', { active: showLazyValue }]"
        >
          {{ showLazyValue ? '隐藏' : '显示' }} 懒计算属性
        </button>
        <span class="lazy-status">
          状态: {{ lazyComputedAccessed ? '已访问' : '未访问' }}
        </span>
      </div>
      <div v-if="showLazyValue" class="lazy-value">
        懒计算结果: {{ lazyComputed }}
      </div>
      <p class="lazy-explanation">
        这个计算属性只有在被访问时才会执行计算函数，展示了Vue 3的懒计算特性
      </p>
    </div>

    <!-- 原理说明 -->
    <div class="explanation">
      <h3>🔬 计算属性原理</h3>
      <div class="principle-grid">
        <div class="principle-item">
          <h4>1. 懒计算机制</h4>
          <p>计算属性只有在被访问时才会执行计算函数，未访问时不会执行</p>
          <pre><code>const computed = computed(() => {
  console.log('计算函数执行')
  return expensiveCalculation()
})

// 计算函数不会执行，直到首次访问
console.log(computed.value) // 现在才执行</code></pre>
        </div>

        <div class="principle-item">
          <h4>2. 缓存机制</h4>
          <p>计算属性会缓存计算结果，只有依赖发生变化时才重新计算</p>
          <pre><code>class ComputedRefImpl {
  constructor(getter) {
    this._getter = getter
    this._dirty = true
    this._value = undefined
  }
  
  get value() {
    if (this._dirty) {
      this._value = this._getter()
      this._dirty = false
    }
    return this._value
  }
}</code></pre>
        </div>

        <div class="principle-item">
          <h4>3. 依赖追踪</h4>
          <p>计算属性会追踪其依赖的响应式数据，当依赖变化时标记为dirty</p>
          <pre><code>// 在computed的effect中
function updateComputed(computed) {
  // 设置当前计算属性为activeSub
  activeSub = computed
  
  try {
    // 执行getter，收集依赖
    const value = computed.fn()
    computed._value = value
    computed.flags |= EffectFlags.EVALUATED
  } finally {
    activeSub = prevSub
  }
}</code></pre>
        </div>

        <div class="principle-item">
          <h4>4. 订阅者模式</h4>
          <p>计算属性同时是依赖的订阅者和其他effect的被依赖对象</p>
          <pre><code>// computed既是Subscriber也是Dep
class ComputedRefImpl implements Subscriber {
  dep = new Dep(this) // 作为依赖
  deps?: Link = undefined // 作为订阅者
  
  notify() {
    // 当依赖变化时，标记为dirty
    this.flags |= EffectFlags.DIRTY
    // 通知订阅了这个computed的effect
    this.dep.notify()
  }
}</code></pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, computed, nextTick, watch } from 'vue'

interface ComputedInfo {
  name: string
  value: any
  computeCount: number
  isCached: boolean
  dependencies: string[]
  description: string
}

interface LogEntry {
  id: number
  time: string
  computedName: string
  message: string
  type: 'compute' | 'access' | 'cache' | 'dirty'
}

// 基础响应式数据
const baseData = reactive({
  a: 10,
  b: 5,
  text: 'Hello Vue',
  items: ['Vue', 'React', 'Angular'],
})

const newItem = ref('')
const autoScroll = ref(true)
const showLazyValue = ref(false)
const lazyComputedAccessed = ref(false)
const logs = ref<LogEntry[]>([])
const logContainer = ref<HTMLElement>()

let logIdCounter = 1

// 计算次数跟踪
const computeCounts = reactive({
  sum: 0,
  product: 0,
  textLength: 0,
  itemsCount: 0,
  complexCalculation: 0,
  expensiveOperation: 0,
  lazyComputed: 0,
})

// 实际的计算属性
const sum = computed(() => {
  computeCounts.sum++
  addLog('sum', `计算 a + b = ${baseData.a} + ${baseData.b}`, 'compute')
  return baseData.a + baseData.b
})

const product = computed(() => {
  computeCounts.product++
  addLog('product', `计算 a × b = ${baseData.a} × ${baseData.b}`, 'compute')
  return baseData.a * baseData.b
})

const textLength = computed(() => {
  computeCounts.textLength++
  addLog(
    'textLength',
    `计算文本长度: "${baseData.text}" = ${baseData.text.length}`,
    'compute',
  )
  return baseData.text.length
})

const itemsCount = computed(() => {
  computeCounts.itemsCount++
  addLog('itemsCount', `计算列表项数量: ${baseData.items.length}`, 'compute')
  return baseData.items.length
})

const complexCalculation = computed(() => {
  computeCounts.complexCalculation++
  const result = Math.sqrt(baseData.a * baseData.a + baseData.b * baseData.b)
  addLog(
    'complexCalculation',
    `复杂计算: √(${baseData.a}² + ${baseData.b}²) = ${result.toFixed(2)}`,
    'compute',
  )
  return result.toFixed(2)
})

const expensiveOperation = computed(() => {
  computeCounts.expensiveOperation++
  // 模拟昂贵的计算
  let result = 0
  for (let i = 0; i < 1000000; i++) {
    result += Math.random()
  }
  const final = (result / 1000000) * baseData.a
  addLog(
    'expensiveOperation',
    `昂贵操作完成，结果: ${final.toFixed(4)}`,
    'compute',
  )
  return final.toFixed(4)
})

// 懒计算演示
const lazyComputed = computed(() => {
  computeCounts.lazyComputed++
  lazyComputedAccessed.value = true
  addLog('lazyComputed', '懒计算属性被访问并执行', 'compute')
  return `懒计算结果: ${Date.now()}`
})

// 计算属性信息列表
const computedList = computed<ComputedInfo[]>(() => {
  return [
    {
      name: 'sum',
      value: sum.value,
      computeCount: computeCounts.sum,
      isCached: true, // 简化显示，实际上需要检查dirty状态
      dependencies: ['a', 'b'],
      description: '两个数字的和',
    },
    {
      name: 'product',
      value: product.value,
      computeCount: computeCounts.product,
      isCached: true,
      dependencies: ['a', 'b'],
      description: '两个数字的积',
    },
    {
      name: 'textLength',
      value: textLength.value,
      computeCount: computeCounts.textLength,
      isCached: true,
      dependencies: ['text'],
      description: '文本长度',
    },
    {
      name: 'itemsCount',
      value: itemsCount.value,
      computeCount: computeCounts.itemsCount,
      isCached: true,
      dependencies: ['items'],
      description: '列表项数量',
    },
    {
      name: 'complexCalculation',
      value: complexCalculation.value,
      computeCount: computeCounts.complexCalculation,
      isCached: true,
      dependencies: ['a', 'b'],
      description: '勾股定理计算',
    },
    {
      name: 'expensiveOperation',
      value: expensiveOperation.value,
      computeCount: computeCounts.expensiveOperation,
      isCached: true,
      dependencies: ['a'],
      description: '模拟昂贵计算',
    },
  ]
})

// 操作方法
function addItem() {
  if (newItem.value.trim()) {
    baseData.items.push(newItem.value.trim())
    newItem.value = ''
  }
}

function removeItem(index: number) {
  baseData.items.splice(index, 1)
}

function toggleLazyComputed() {
  showLazyValue.value = !showLazyValue.value
  if (!showLazyValue.value) {
    lazyComputedAccessed.value = false
  }
}

// 日志管理
function addLog(computedName: string, message: string, type: LogEntry['type']) {
  logs.value.push({
    id: logIdCounter++,
    time: new Date().toLocaleTimeString(),
    computedName,
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

// 监听依赖变化以记录日志
watch(
  () => baseData.a,
  (newVal, oldVal) => {
    addLog(
      'system',
      `依赖 'a' 变化: ${oldVal} → ${newVal}，相关计算属性将重新计算`,
      'dirty',
    )
  },
)

watch(
  () => baseData.b,
  (newVal, oldVal) => {
    addLog(
      'system',
      `依赖 'b' 变化: ${oldVal} → ${newVal}，相关计算属性将重新计算`,
      'dirty',
    )
  },
)

watch(
  () => baseData.text,
  (newVal, oldVal) => {
    addLog('system', `依赖 'text' 变化: "${oldVal}" → "${newVal}"`, 'dirty')
  },
)

watch(
  () => baseData.items,
  (newVal, oldVal) => {
    addLog('system', `依赖 'items' 变化，新长度: ${newVal.length}`, 'dirty')
  },
  { deep: true },
)
</script>

<style scoped>
.computed-demo {
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
.computed-panel,
.log-panel {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.data-panel h3,
.computed-panel h3,
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

.number-input,
.text-input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 1rem;
}

.list-controls {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.add-btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  background: #42b883;
  color: white;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.3s ease;
}

.add-btn:hover {
  background: #369870;
}

.items-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.item-tag {
  background: #e9ecef;
  color: #495057;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.remove-item {
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 50%;
  width: 16px;
  height: 16px;
  font-size: 0.7rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.computed-list {
  max-height: 400px;
  overflow-y: auto;
}

.computed-item {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
  border: 1px solid #e0e0e0;
}

.computed-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.5rem;
}

.computed-name {
  font-weight: bold;
  color: #333;
  font-size: 1rem;
}

.computed-stats {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.25rem;
  font-size: 0.8rem;
}

.compute-count {
  color: #666;
}

.cached-status {
  padding: 0.125rem 0.5rem;
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: 500;
}

.cached-status.cached {
  background: #d4edda;
  color: #155724;
}

.cached-status:not(.cached) {
  background: #f8d7da;
  color: #721c24;
}

.computed-value {
  font-family: 'Monaco', 'Consolas', monospace;
  color: #333;
  margin-bottom: 0.5rem;
  background: white;
  padding: 0.5rem;
  border-radius: 4px;
  border: 1px solid #e0e0e0;
}

.computed-deps {
  font-size: 0.8rem;
  color: #666;
  margin-bottom: 0.5rem;
}

.computed-desc {
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
  grid-template-columns: 80px 120px 1fr;
  gap: 0.5rem;
}

.log-entry.compute {
  color: #4ade80;
}

.log-entry.access {
  color: #06b6d4;
}

.log-entry.cache {
  color: #a78bfa;
}

.log-entry.dirty {
  color: #f59e0b;
}

.log-time {
  color: #888;
  font-size: 0.7rem;
}

.log-computed {
  font-weight: bold;
}

.values-panel,
.lazy-demo-panel {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  margin-bottom: 2rem;
}

.values-panel h3,
.lazy-demo-panel h3 {
  margin-bottom: 1rem;
  color: #333;
  font-size: 1.2rem;
}

.values-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}

.value-item {
  background: #f8f9fa;
  padding: 1rem;
  border-radius: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.value-label {
  font-weight: 500;
  color: #555;
}

.value-result {
  font-family: 'Monaco', 'Consolas', monospace;
  background: white;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  border: 1px solid #e0e0e0;
  color: #333;
  font-weight: bold;
}

.lazy-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
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

.lazy-status {
  font-size: 0.9rem;
  color: #666;
}

.lazy-value {
  background: #f8f9fa;
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1rem;
  font-family: 'Monaco', 'Consolas', monospace;
  border: 1px solid #e0e0e0;
}

.lazy-explanation {
  color: #666;
  font-style: italic;
  line-height: 1.5;
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
  grid-template-columns: repeat(auto-fit, minmax(450px, 1fr));
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

  .values-grid {
    grid-template-columns: 1fr;
  }
}
</style>
