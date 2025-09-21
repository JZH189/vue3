<template>
  <div class="reactive-demo">
    <h2>🌟 响应式对象演示</h2>
    <p class="description">
      通过Proxy机制，Vue 3可以拦截对象的所有操作，实现精确的响应式追踪
    </p>

    <div class="demo-grid">
      <!-- 操作面板 -->
      <div class="control-panel">
        <h3>🎮 操作面板</h3>

        <div class="control-group">
          <label>修改姓名:</label>
          <input
            v-model="inputName"
            @input="updateName"
            placeholder="输入新姓名"
          />
        </div>

        <div class="control-group">
          <label>修改年龄:</label>
          <input
            type="number"
            v-model.number="inputAge"
            @input="updateAge"
            placeholder="输入年龄"
          />
        </div>

        <div class="control-group">
          <button @click="addSkill" class="action-btn">添加技能</button>
          <input
            v-model="newSkill"
            @keyup.enter="addSkill"
            placeholder="输入技能名称"
          />
        </div>

        <div class="control-group">
          <button @click="resetData" class="reset-btn">重置数据</button>
        </div>
      </div>

      <!-- 响应式对象状态 -->
      <div class="state-panel">
        <h3>📊 响应式对象状态</h3>
        <div class="state-display">
          <div class="state-item">
            <span class="label">姓名:</span>
            <span class="value">{{ reactiveUser.name }}</span>
          </div>
          <div class="state-item">
            <span class="label">年龄:</span>
            <span class="value">{{ reactiveUser.age }}</span>
          </div>
          <div class="state-item">
            <span class="label">技能:</span>
            <div class="skills-list">
              <span
                v-for="skill in reactiveUser.skills"
                :key="skill"
                class="skill-tag"
              >
                {{ skill }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- 代理拦截日志 -->
      <div class="log-panel">
        <h3>📝 Proxy拦截日志</h3>
        <div class="log-controls">
          <button @click="clearLogs" class="clear-btn">清空日志</button>
          <label>
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
            <span class="log-operation">{{ log.operation }}</span>
            <span class="log-target">{{ log.target }}</span>
            <span class="log-value">{{ log.value }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 原理说明 -->
    <div class="explanation">
      <h3>🔬 实现原理</h3>
      <div class="principle-grid">
        <div class="principle-item">
          <h4>1. Proxy拦截</h4>
          <p>Vue 3使用ES6 Proxy拦截对象的get、set、has、deleteProperty等操作</p>
          <pre><code>new Proxy(target, {
  get(target, key) {
    track(target, key) // 依赖收集
    return Reflect.get(target, key)
  },
  set(target, key, value) {
    const result = Reflect.set(target, key, value)
    trigger(target, key) // 触发更新
    return result
  }
})</code></pre>
        </div>

        <div class="principle-item">
          <h4>2. 依赖收集</h4>
          <p>在get拦截器中收集当前活跃的effect，建立属性与effect的依赖关系</p>
          <pre><code>function track(target, key) {
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
  }
}</code></pre>
        </div>

        <div class="principle-item">
          <h4>3. 触发更新</h4>
          <p>在set拦截器中触发与该属性相关的所有effect重新执行</p>
          <pre><code>function trigger(target, key) {
  const depsMap = targetMap.get(target)
  if (!depsMap) return
  const dep = depsMap.get(key)
  if (dep) {
    dep.forEach(effect => effect())
  }
}</code></pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, nextTick, watch } from 'vue'

// 响应式数据
const reactiveUser = reactive({
  name: 'Vue开发者',
  age: 25,
  skills: ['JavaScript', 'Vue.js', 'TypeScript'],
})

// 输入控制
const inputName = ref(reactiveUser.name)
const inputAge = ref(reactiveUser.age)
const newSkill = ref('')
const autoScroll = ref(true)

// 日志系统
interface LogEntry {
  id: number
  time: string
  operation: string
  target: string
  value: string
  type: 'get' | 'set' | 'has' | 'deleteProperty'
}

const logs = ref<LogEntry[]>([])
const logContainer = ref<HTMLElement>()
let logId = 0

// 创建带日志的响应式对象
function createLoggingProxy<T extends object>(target: T, name: string): T {
  return new Proxy(target, {
    get(obj, prop) {
      const value = Reflect.get(obj, prop)
      addLog('get', `${name}.${String(prop)}`, JSON.stringify(value), 'get')
      return value
    },

    set(obj, prop, value) {
      const result = Reflect.set(obj, prop, value)
      addLog('set', `${name}.${String(prop)}`, JSON.stringify(value), 'set')
      return result
    },

    has(obj, prop) {
      const result = Reflect.has(obj, prop)
      addLog('has', `${name}.${String(prop)}`, String(result), 'has')
      return result
    },

    deleteProperty(obj, prop) {
      const result = Reflect.deleteProperty(obj, prop)
      addLog(
        'deleteProperty',
        `${name}.${String(prop)}`,
        String(result),
        'deleteProperty',
      )
      return result
    },
  })
}

// 添加日志
function addLog(
  operation: string,
  target: string,
  value: string,
  type: LogEntry['type'],
) {
  logs.value.push({
    id: logId++,
    time: new Date().toLocaleTimeString(),
    operation,
    target,
    value,
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

// 操作方法
function updateName() {
  reactiveUser.name = inputName.value
}

function updateAge() {
  reactiveUser.age = inputAge.value
}

function addSkill() {
  if (newSkill.value.trim()) {
    reactiveUser.skills.push(newSkill.value.trim())
    newSkill.value = ''
  }
}

function resetData() {
  reactiveUser.name = 'Vue开发者'
  reactiveUser.age = 25
  reactiveUser.skills.splice(
    0,
    reactiveUser.skills.length,
    'JavaScript',
    'Vue.js',
    'TypeScript',
  )
  inputName.value = reactiveUser.name
  inputAge.value = reactiveUser.age
}

function clearLogs() {
  logs.value = []
}

// 监听响应式对象变化来模拟日志记录
watch(
  () => reactiveUser.name,
  newVal => {
    addLog('watch', 'reactiveUser.name', JSON.stringify(newVal), 'set')
  },
  { flush: 'sync' },
)

watch(
  () => reactiveUser.age,
  newVal => {
    addLog('watch', 'reactiveUser.age', JSON.stringify(newVal), 'set')
  },
  { flush: 'sync' },
)

watch(
  () => reactiveUser.skills,
  newVal => {
    addLog('watch', 'reactiveUser.skills', JSON.stringify(newVal), 'set')
  },
  { deep: true, flush: 'sync' },
)
</script>

<style scoped>
.reactive-demo {
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

.control-panel,
.state-panel,
.log-panel {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.control-panel h3,
.state-panel h3,
.log-panel h3 {
  margin-bottom: 1rem;
  color: #333;
  font-size: 1.2rem;
}

.control-group {
  margin-bottom: 1rem;
}

.control-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #555;
}

.control-group input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 1rem;
}

.action-btn,
.reset-btn,
.clear-btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  transition: all 0.3s ease;
}

.action-btn {
  background: #42b883;
  color: white;
  margin-bottom: 0.5rem;
}

.action-btn:hover {
  background: #369870;
}

.reset-btn {
  background: #f39c12;
  color: white;
}

.reset-btn:hover {
  background: #e67e22;
}

.clear-btn {
  background: #e74c3c;
  color: white;
  margin-right: 1rem;
}

.clear-btn:hover {
  background: #c0392b;
}

.state-display {
  background: #f8f9fa;
  padding: 1rem;
  border-radius: 8px;
}

.state-item {
  margin-bottom: 0.8rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.state-item .label {
  font-weight: 600;
  color: #555;
  min-width: 60px;
}

.state-item .value {
  color: #333;
  font-family: 'Monaco', 'Consolas', monospace;
  background: white;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  border: 1px solid #e0e0e0;
}

.skills-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.skill-tag {
  background: #42b883;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.8rem;
}

.log-controls {
  display: flex;
  align-items: center;
  margin-bottom: 1rem;
  gap: 1rem;
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
  grid-template-columns: 80px 80px 1fr 1fr;
  gap: 0.5rem;
}

.log-entry.get {
  color: #4ade80;
}

.log-entry.set {
  color: #f59e0b;
}

.log-entry.has {
  color: #06b6d4;
}

.log-entry.deleteProperty {
  color: #ef4444;
}

.log-time {
  color: #888;
  font-size: 0.7rem;
}

.log-operation {
  font-weight: bold;
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
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
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
}
</style>
