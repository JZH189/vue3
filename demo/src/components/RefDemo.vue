<template>
  <div class="ref-demo">
    <h2>🎯 Ref 响应式引用演示</h2>
    <p class="description">
      Ref 用于创建响应式的值引用，可以包装基本类型和对象类型
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

      <!-- 代码示例 -->
      <div class="source-code-panel">
        <div class="source-code-header">
          <h3>💻 代码示例</h3>
        </div>
        <div class="source-code-content">
          <pre><code>// Ref 响应式数据
const nameRef = ref('Vue开发者')
const ageRef = ref(25)
const skillsRef = ref(['JavaScript', 'Vue.js', 'TypeScript'])

// 修改姓名
function updateName() {
  nameRef.value = inputName.value
}

// 修改年龄
function updateAge() {
  ageRef.value = inputAge.value
}

// 添加技能
function addSkill() {
  if (newSkill.value.trim()) {
    skillsRef.value.push(newSkill.value.trim())
    newSkill.value = ''
  }
}

// 重置数据 
function resetData() {
  nameRef.value = 'Vue开发者'
  ageRef.value = 25
  skillsRef.value.splice(
    0,
    skillsRef.value.length,
    'JavaScript',
    'Vue.js',
    'TypeScript',
  )
}</code></pre>
        </div>
      </div>

      <!-- Ref状态 -->
      <div class="state-panel">
        <h3>📊 Ref 状态</h3>
        <div class="state-display">
          <div class="state-item">
            <span class="label">姓名:</span>
            <span class="value">{{ nameRef }}</span>
          </div>
          <div class="state-item">
            <span class="label">年龄:</span>
            <span class="value">{{ ageRef }}</span>
          </div>
          <div class="state-item">
            <span class="label">技能:</span>
            <div class="skills-list">
              <span v-for="skill in skillsRef" :key="skill" class="skill-tag">
                {{ skill }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- 代理拦截日志 -->
      <div class="log-panel">
        <h3>📝 Ref 访问日志</h3>
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
      <h3>🔬 Ref 实现原理</h3>
      <div class="principle-grid">
        <div class="principle-item">
          <h4>1. Ref 类定义</h4>
          <p>Ref 通过一个包含 value 属性的对象来包装值，实现响应式</p>
          <pre><code>class RefImpl&lt;T&gt; {
  private _value: T
  private _rawValue: T
  public dep?: Dep = undefined
  public readonly __v_isRef = true

  constructor(value: T, public readonly __v_isShallow: boolean) {
    this._rawValue = __v_isShallow ? value : toRaw(value)
    this._value = __v_isShallow ? value : toReactive(value)
  }

  get value() {
    trackRefValue(this)
    return this._value
  }

  set value(newVal) {
    const useDirectValue =
      this.__v_isShallow || isShallow(newVal) || isReadonly(newVal)
    if (hasChanged(this._rawValue, newVal)) {
      this._rawValue = newVal
      this._value = useDirectValue ? newVal : toReactive(newVal)
      triggerRefValue(this, newVal)
    }
  }
}</code></pre>
        </div>

        <div class="principle-item">
          <h4>2. 依赖收集</h4>
          <p>在 getter 中收集依赖，建立 ref 与 effect 的关系</p>
          <pre><code>export function trackRefValue(ref: RefBase&lt;any&gt;) {
  if (shouldTrack && activeEffect) {
    ref = toRaw(ref)
    let dep = ref.dep
    if (!dep) {
      ref.dep = dep = createDep()
    }
    trackEffect(
      activeEffect,
      dep,
      __DEV__
        ? {
            target: ref,
            type: TrackOpTypes.GET,
            key: 'value',
          }
        : void 0,
    )
  }
}</code></pre>
        </div>

        <div class="principle-item">
          <h4>3. 触发更新</h4>
          <p>在 setter 中触发与该 ref 相关的所有 effect 重新执行</p>
          <pre><code>export function triggerRefValue(
  ref: RefBase&lt;any&gt;,
  newVal?: any,
) {
  ref = toRaw(ref)
  const dep = ref.dep
  if (dep) {
    if (__DEV__) {
      triggerEffects(dep, {
        target: ref,
        type: TriggerOpTypes.SET,
        key: 'value',
        newValue: newVal,
      })
    } else {
      triggerEffects(dep)
    }
  }
}</code></pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'

// Ref 响应式数据
const nameRef = ref('Vue开发者')
const ageRef = ref(25)
const skillsRef = ref(['JavaScript', 'Vue.js', 'TypeScript'])

// 输入控制
const inputName = ref(nameRef.value)
const inputAge = ref(ageRef.value)
const newSkill = ref('')
const autoScroll = ref(true)

// 日志系统
interface LogEntry {
  id: number
  time: string
  operation: string
  target: string
  value: string
  type: 'get' | 'set'
}

const logs = ref<LogEntry[]>([])
const logContainer = ref<HTMLElement>()
let logId = 0

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
  nameRef.value = inputName.value
  addLog('set', 'nameRef.value', JSON.stringify(inputName.value), 'set')
}

function updateAge() {
  ageRef.value = inputAge.value
  addLog('set', 'ageRef.value', JSON.stringify(inputAge.value), 'set')
}

function addSkill() {
  if (newSkill.value.trim()) {
    const skill = newSkill.value.trim()
    skillsRef.value.push(skill)
    addLog('set', 'skillsRef.value', `添加技能: ${skill}`, 'set')
    newSkill.value = ''
  }
}

function resetData() {
  nameRef.value = 'Vue开发者'
  ageRef.value = 25
  skillsRef.value.splice(
    0,
    skillsRef.value.length,
    'JavaScript',
    'Vue.js',
    'TypeScript',
  )
  inputName.value = nameRef.value
  inputAge.value = ageRef.value
  addLog('set', 'refs', '重置所有数据', 'set')
}

function clearLogs() {
  logs.value = []
}
</script>

<style scoped>
.ref-demo {
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

.log-panel {
  grid-column: span 3;
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

.source-code-panel {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.source-code-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.source-code-header h3 {
  margin: 0;
  color: #333;
  font-size: 1.2rem;
}

.source-code-content {
  background: #1a1a1a;
  color: #f0f0f0;
  padding: 1rem;
  border-radius: 8px;
  font-family: 'Monaco', 'Consolas', monospace;
  font-size: 0.9rem;
  overflow-x: auto;
}

.source-code-content code {
  line-height: 1.4;
}

@media (max-width: 1024px) {
  .demo-grid {
    grid-template-columns: 1fr;
  }

  .principle-grid {
    grid-template-columns: 1fr;
  }

  .source-code-panel {
    grid-column: span 1;
  }
}
</style>
