<template>
  <div class="advanced-reactive-flow">
    <h3>🌀 Vue 3 响应式系统动态流程图</h3>
    <p class="description">
      实时展示响应式数据流的完整生命周期：从依赖收集到更新触发
    </p>

    <div class="flow-container">
      <!-- 控制面板 -->
      <div class="flow-controls">
        <div class="control-group">
          <label>演示模式:</label>
          <select v-model="demoMode" class="mode-select">
            <option value="complete">完整流程</option>
            <option value="track">依赖收集</option>
            <option value="trigger">更新触发</option>
          </select>
        </div>

        <div class="control-group">
          <label>动画速度:</label>
          <input
            v-model="animationSpeed"
            type="range"
            min="500"
            max="2000"
            step="100"
            class="speed-slider"
          />
          <span class="speed-value">{{ animationSpeed }}ms</span>
        </div>

        <div class="control-buttons">
          <button @click="startFlow" :disabled="isRunning" class="start-btn">
            {{ isRunning ? '演示中...' : '开始演示' }}
          </button>
          <button @click="resetFlow" class="reset-btn">重置</button>
        </div>
      </div>

      <!-- 主流程图 -->
      <div class="flow-diagram">
        <svg width="100%" height="600" viewBox="0 0 1200 600">
          <!-- 背景装饰 -->
          <defs>
            <radialGradient id="bgGradient" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#f8f9fa" />
              <stop offset="100%" stop-color="#e9ecef" />
            </radialGradient>

            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="10"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="#42b883" />
            </marker>

            <marker
              id="arrowhead-red"
              markerWidth="10"
              markerHeight="7"
              refX="10"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="#e74c3c" />
            </marker>
          </defs>

          <rect width="100%" height="100%" fill="url(#bgGradient)" />

          <!-- 流程阶段区域 -->
          <rect
            x="50"
            y="50"
            width="300"
            height="500"
            rx="15"
            class="stage-area"
            :class="{ active: currentStage === 1 }"
          />
          <text x="200" y="80" text-anchor="middle" class="stage-title">
            阶段 1: 依赖收集
          </text>

          <rect
            x="425"
            y="50"
            width="350"
            height="500"
            rx="15"
            class="stage-area"
            :class="{ active: currentStage === 2 }"
          />
          <text x="600" y="80" text-anchor="middle" class="stage-title">
            阶段 2: 数据变更
          </text>

          <rect
            x="825"
            y="50"
            width="300"
            height="500"
            rx="15"
            class="stage-area"
            :class="{ active: currentStage === 3 }"
          />
          <text x="975" y="80" text-anchor="middle" class="stage-title">
            阶段 3: 更新触发
          </text>

          <!-- Ref 对象 -->
          <g
            :transform="`translate(${positions.ref.x}, ${positions.ref.y})`"
            class="component ref-component"
            :class="{
              active: activeComponents.ref,
              highlight: highlighted.ref,
            }"
          >
            <circle r="50" class="component-bg" />
            <text y="-5" text-anchor="middle" class="component-title">Ref</text>
            <text y="15" text-anchor="middle" class="component-value">
              {{ refData.value }}
            </text>
          </g>

          <!-- Dep 对象 -->
          <g
            :transform="`translate(${positions.dep.x}, ${positions.dep.y})`"
            class="component dep-component"
            :class="{
              active: activeComponents.dep,
              highlight: highlighted.dep,
            }"
          >
            <rect
              x="-60"
              y="-40"
              width="120"
              height="80"
              rx="10"
              class="component-bg"
            />
            <text y="-15" text-anchor="middle" class="component-title">
              Dep
            </text>
            <text y="5" text-anchor="middle" class="component-prop">
              ver: {{ depData.version }}
            </text>
            <text y="25" text-anchor="middle" class="component-prop">
              subs: {{ depData.subs }}
            </text>
          </g>

          <!-- Link 对象 -->
          <g
            :transform="`translate(${positions.link.x}, ${positions.link.y})`"
            class="component link-component"
            :class="{
              active: activeComponents.link,
              highlight: highlighted.link,
            }"
          >
            <polygon points="0,-40 40,0 0,40 -40,0" class="component-bg" />
            <text y="-5" text-anchor="middle" class="component-title">
              Link
            </text>
            <text y="15" text-anchor="middle" class="component-prop">
              ver: {{ linkData.version }}
            </text>
          </g>

          <!-- ReactiveEffect 对象 -->
          <g
            :transform="`translate(${positions.effect.x}, ${positions.effect.y})`"
            class="component effect-component"
            :class="{
              active: activeComponents.effect,
              highlight: highlighted.effect,
            }"
          >
            <rect
              x="-70"
              y="-40"
              width="140"
              height="80"
              rx="10"
              class="component-bg"
            />
            <text y="-15" text-anchor="middle" class="component-title">
              Effect
            </text>
            <text y="5" text-anchor="middle" class="component-prop">
              flags: {{ effectData.flags }}
            </text>
            <text y="25" text-anchor="middle" class="component-prop">
              deps: {{ effectData.deps }}
            </text>
          </g>

          <!-- 连接线 -->
          <!-- Ref -> Dep -->
          <line
            :x1="positions.ref.x + 50"
            :y1="positions.ref.y"
            :x2="positions.dep.x - 60"
            :y2="positions.dep.y"
            class="connection-line"
            :class="{
              active: connections.refDep.active,
              flow: connections.refDep.flow,
            }"
            marker-end="url(#arrowhead)"
          />

          <!-- Dep -> Link -->
          <line
            :x1="positions.dep.x + 60"
            :y1="positions.dep.y"
            :x2="positions.link.x - 40"
            :y2="positions.link.y"
            class="connection-line"
            :class="{
              active: connections.depLink.active,
              flow: connections.depLink.flow,
            }"
            marker-end="url(#arrowhead)"
          />

          <!-- Link -> Effect -->
          <line
            :x1="positions.link.x + 40"
            :y1="positions.link.y"
            :x2="positions.effect.x - 70"
            :y2="positions.effect.y"
            class="connection-line"
            :class="{
              active: connections.linkEffect.active,
              flow: connections.linkEffect.flow,
            }"
            marker-end="url(#arrowhead)"
          />

          <!-- 反向连接 -->
          <line
            :x1="positions.effect.x - 70"
            :y1="positions.effect.y - 40"
            :x2="positions.link.x + 40"
            :y2="positions.link.y - 40"
            class="connection-line reverse"
            :class="{
              active: connections.effectLink.active,
              flow: connections.effectLink.flow,
            }"
            marker-end="url(#arrowhead-red)"
          />

          <line
            :x1="positions.link.x - 40"
            :y1="positions.link.y - 40"
            :x2="positions.dep.x + 60"
            :y2="positions.dep.y - 40"
            class="connection-line reverse"
            :class="{
              active: connections.linkDep.active,
              flow: connections.linkDep.flow,
            }"
            marker-end="url(#arrowhead-red)"
          />

          <line
            :x1="positions.dep.x - 60"
            :y1="positions.dep.y - 40"
            :x2="positions.ref.x + 50"
            :y2="positions.ref.y - 40"
            class="connection-line reverse"
            :class="{
              active: connections.depRef.active,
              flow: connections.depRef.flow,
            }"
            marker-end="url(#arrowhead-red)"
          />

          <!-- 数据流动动画点 -->
          <circle
            v-for="(point, index) in flowPoints"
            :key="index"
            :cx="point.x"
            :cy="point.y"
            :r="point.radius"
            class="flow-point"
            :class="{ active: point.active }"
            :style="{ fill: point.color }"
          />
        </svg>
      </div>

      <!-- 流程说明 -->
      <div class="flow-explanation">
        <div class="explanation-header">
          <h4>当前阶段: {{ currentExplanation.title }}</h4>
          <div class="stage-indicator">
            <div
              v-for="i in 6"
              :key="i"
              class="stage-dot"
              :class="{ active: currentStep >= i, current: currentStep === i }"
            ></div>
          </div>
        </div>
        <p class="explanation-text">{{ currentExplanation.description }}</p>
      </div>

      <!-- 组件详情 -->
      <div class="component-details">
        <h4>组件详情</h4>
        <div class="details-grid">
          <div
            v-for="(detail, key) in componentDetails"
            :key="key"
            class="detail-card"
            :class="{ active: activeDetail === key }"
            @click="activeDetail = key"
          >
            <h5>{{ detail.title }}</h5>
            <p>{{ detail.description }}</p>
            <div class="detail-code" v-if="detail.code">
              <pre><code>{{ detail.code }}</code></pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'

// Props
const props = defineProps({
  refValue: {
    type: [String, Number],
    default: '',
  },
  depVersion: {
    type: Number,
    default: 0,
  },
  depSubs: {
    type: Number,
    default: 0,
  },
  linkVersion: {
    type: Number,
    default: 0,
  },
  effectFlags: {
    type: String,
    default: 'ACTIVE | TRACKING',
  },
  effectDeps: {
    type: Number,
    default: 0,
  },
})

// 状态管理
const demoMode = ref('complete')
const animationSpeed = ref(1000)
const isRunning = ref(false)
const currentStage = ref(0)
const currentStep = ref(0)
const activeDetail = ref('ref')

// 组件位置
const positions = reactive({
  ref: { x: 200, y: 300 },
  dep: { x: 500, y: 200 },
  link: { x: 700, y: 300 },
  effect: { x: 1000, y: 200 },
})

// 组件数据
const refData = reactive({
  value: props.refValue,
})

const depData = reactive({
  version: props.depVersion,
  subs: props.depSubs,
})

const linkData = reactive({
  version: props.linkVersion,
})

const effectData = reactive({
  flags: props.effectFlags,
  deps: props.effectDeps,
})

// 活跃组件状态
const activeComponents = reactive({
  ref: false,
  dep: false,
  link: false,
  effect: false,
})

// 高亮组件状态
const highlighted = reactive({
  ref: false,
  dep: false,
  link: false,
  effect: false,
})

// 连接线状态
const connections = reactive({
  refDep: { active: false, flow: false },
  depLink: { active: false, flow: false },
  linkEffect: { active: false, flow: false },
  effectLink: { active: false, flow: false },
  linkDep: { active: false, flow: false },
  depRef: { active: false, flow: false },
})

// 数据流动点
const flowPoints = ref<
  Array<{
    x: number
    y: number
    radius: number
    color: string
    active: boolean
  }>
>([])

// 流程步骤
const flowSteps = [
  { stage: 0, title: '准备阶段', description: '初始化响应式系统组件' },
  { stage: 1, title: '访问 Ref', description: '读取 Ref 的值，触发 getter' },
  { stage: 1, title: '依赖收集开始', description: 'Dep 开始收集依赖' },
  {
    stage: 1,
    title: '创建 Link',
    description: '建立 Dep 与 Effect 之间的连接',
  },
  { stage: 2, title: '修改 Ref', description: '设置 Ref 新值，触发 setter' },
  { stage: 3, title: '触发更新', description: 'Dep 通知所有订阅者' },
  { stage: 3, title: '执行副作用', description: 'Effect 重新执行副作用函数' },
]

// 当前说明
const currentExplanation = computed(() => {
  return flowSteps[currentStep.value] || flowSteps[0]
})

// 组件详情
const componentDetails = {
  ref: {
    title: 'Ref 对象',
    description: 'Vue 3 响应式系统的基础，用于包装基本类型值使其具有响应性。',
    code: `class RefImpl<T> {
  private _value: T
  public dep?: Dep = undefined

  get value() {
    trackRefValue(this)
    return this._value
  }

  set value(newVal) {
    this._value = newVal
    triggerRefValue(this, newVal)
  }
}`,
  },
  dep: {
    title: 'Dep 对象',
    description: '依赖管理器，负责收集和通知订阅者。',
    code: `class Dep {
  version = 0
  subs?: Link = undefined

  track() {
    // 收集依赖
  }

  trigger() {
    // 通知订阅者
  }
}`,
  },
  link: {
    title: 'Link 对象',
    description: '连接 Dep 和 Subscriber 的桥梁，形成高效的双向链表结构。',
    code: `class Link {
  version: number
  sub: Subscriber
  dep: Dep

  constructor(sub: Subscriber, dep: Dep) {
    this.version = dep.version
    this.sub = sub
    this.dep = dep
  }
}`,
  },
  effect: {
    title: 'ReactiveEffect',
    description: '代表副作用函数，会在依赖变化时重新执行。',
    code: `class ReactiveEffect<T = any> {
  fn: () => T
  deps?: Link = undefined

  run() {
    // 执行副作用函数
  }

  trigger() {
    // 触发更新
  }
}`,
  },
}

// 方法
function startFlow() {
  if (isRunning.value) return
  isRunning.value = true
  currentStep.value = 0
  currentStage.value = 0

  // 重置状态
  resetStates()

  // 根据模式执行不同的流程
  if (demoMode.value === 'track') {
    runTrackFlow()
  } else if (demoMode.value === 'trigger') {
    runTriggerFlow()
  } else {
    runCompleteFlow()
  }
}

function runCompleteFlow() {
  const steps = [
    () => {
      // 步骤 1: 激活 Ref
      currentStep.value = 1
      currentStage.value = 1
      activeComponents.ref = true
      highlighted.ref = true
    },
    () => {
      // 步骤 2: Ref -> Dep
      currentStep.value = 2
      connections.refDep.active = true
      connections.refDep.flow = true
      createFlowPoint(
        positions.ref.x + 50,
        positions.ref.y,
        positions.dep.x - 60,
        positions.dep.y,
      )
    },
    () => {
      // 步骤 3: 激活 Dep
      currentStep.value = 3
      activeComponents.dep = true
      highlighted.dep = true
      connections.refDep.flow = false
    },
    () => {
      // 步骤 4: Dep -> Link
      currentStep.value = 4
      connections.depLink.active = true
      connections.depLink.flow = true
      createFlowPoint(
        positions.dep.x + 60,
        positions.dep.y,
        positions.link.x - 40,
        positions.link.y,
      )
    },
    () => {
      // 步骤 5: 激活 Link
      currentStep.value = 5
      activeComponents.link = true
      highlighted.link = true
      connections.depLink.flow = false
    },
    () => {
      // 步骤 6: Link -> Effect
      currentStep.value = 6
      currentStage.value = 2
      connections.linkEffect.active = true
      connections.linkEffect.flow = true
      createFlowPoint(
        positions.link.x + 40,
        positions.link.y,
        positions.effect.x - 70,
        positions.effect.y,
      )
    },
    () => {
      // 步骤 7: 激活 Effect
      currentStep.value = 7
      currentStage.value = 3
      activeComponents.effect = true
      highlighted.effect = true
      connections.linkEffect.flow = false
    },
    () => {
      // 步骤 8: Effect -> Link (反向)
      connections.effectLink.active = true
      connections.effectLink.flow = true
      createFlowPoint(
        positions.effect.x - 70,
        positions.effect.y - 40,
        positions.link.x + 40,
        positions.link.y - 40,
        '#e74c3c',
      )
    },
    () => {
      // 步骤 9: Link -> Dep (反向)
      connections.effectLink.flow = false
      connections.linkDep.active = true
      connections.linkDep.flow = true
      createFlowPoint(
        positions.link.x - 40,
        positions.link.y - 40,
        positions.dep.x + 60,
        positions.dep.y - 40,
        '#e74c3c',
      )
    },
    () => {
      // 步骤 10: Dep -> Ref (反向)
      connections.linkDep.flow = false
      connections.depRef.active = true
      connections.depRef.flow = true
      createFlowPoint(
        positions.dep.x - 60,
        positions.dep.y - 40,
        positions.ref.x + 50,
        positions.ref.y - 40,
        '#e74c3c',
      )
      depData.version++ // 增加版本号
    },
    () => {
      // 步骤 11: 完成
      connections.depRef.flow = false
      isRunning.value = false
    },
  ]

  executeSteps(steps, 0)
}

function runTrackFlow() {
  // 简化版依赖收集流程
  const steps = [
    () => {
      // 步骤 1: 激活 Ref
      currentStep.value = 1
      currentStage.value = 1
      activeComponents.ref = true
      highlighted.ref = true
    },
    () => {
      // 步骤 2: Ref -> Dep
      currentStep.value = 2
      connections.refDep.active = true
      connections.refDep.flow = true
      createFlowPoint(
        positions.ref.x + 50,
        positions.ref.y,
        positions.dep.x - 60,
        positions.dep.y,
      )
    },
    () => {
      // 步骤 3: 激活 Dep
      currentStep.value = 3
      activeComponents.dep = true
      highlighted.dep = true
      connections.refDep.flow = false
    },
    () => {
      // 步骤 4: Dep -> Link
      currentStep.value = 4
      connections.depLink.active = true
      connections.depLink.flow = true
      createFlowPoint(
        positions.dep.x + 60,
        positions.dep.y,
        positions.link.x - 40,
        positions.link.y,
      )
    },
    () => {
      // 步骤 5: 激活 Link
      currentStep.value = 5
      activeComponents.link = true
      highlighted.link = true
      connections.depLink.flow = false
    },
    () => {
      // 步骤 6: Link -> Effect
      currentStep.value = 6
      connections.linkEffect.active = true
      connections.linkEffect.flow = true
      createFlowPoint(
        positions.link.x + 40,
        positions.link.y,
        positions.effect.x - 70,
        positions.effect.y,
      )
    },
    () => {
      // 步骤 7: 激活 Effect
      currentStep.value = 7
      activeComponents.effect = true
      highlighted.effect = true
      connections.linkEffect.flow = false
    },
    () => {
      // 步骤 8: 完成
      isRunning.value = false
    },
  ]

  executeSteps(steps, 0)
}

function runTriggerFlow() {
  // 简化版更新触发流程
  const steps = [
    () => {
      // 步骤 1: 激活 Ref
      currentStep.value = 1
      currentStage.value = 2
      activeComponents.ref = true
      highlighted.ref = true
    },
    () => {
      // 步骤 2: 修改 Ref 值
      currentStep.value = 2
      currentStage.value = 2
      // 模拟值变化
    },
    () => {
      // 步骤 3: Ref -> Dep
      currentStep.value = 3
      connections.refDep.active = true
      connections.refDep.flow = true
      createFlowPoint(
        positions.ref.x + 50,
        positions.ref.y,
        positions.dep.x - 60,
        positions.dep.y,
      )
    },
    () => {
      // 步骤 4: 激活 Dep 并增加版本
      currentStep.value = 4
      currentStage.value = 3
      activeComponents.dep = true
      highlighted.dep = true
      connections.refDep.flow = false
      depData.version++ // 增加版本号
    },
    () => {
      // 步骤 5: Dep -> Link
      currentStep.value = 5
      connections.depLink.active = true
      connections.depLink.flow = true
      createFlowPoint(
        positions.dep.x + 60,
        positions.dep.y,
        positions.link.x - 40,
        positions.link.y,
      )
    },
    () => {
      // 步骤 6: 激活 Link
      currentStep.value = 6
      activeComponents.link = true
      highlighted.link = true
      connections.depLink.flow = false
    },
    () => {
      // 步骤 7: Link -> Effect
      currentStep.value = 7
      connections.linkEffect.active = true
      connections.linkEffect.flow = true
      createFlowPoint(
        positions.link.x + 40,
        positions.link.y,
        positions.effect.x - 70,
        positions.effect.y,
      )
    },
    () => {
      // 步骤 8: 激活 Effect
      currentStep.value = 8
      activeComponents.effect = true
      highlighted.effect = true
      connections.linkEffect.flow = false
    },
    () => {
      // 步骤 9: 完成
      isRunning.value = false
    },
  ]

  executeSteps(steps, 0)
}

function executeSteps(steps: (() => void)[], index: number) {
  if (index >= steps.length) {
    return
  }

  steps[index]()

  if (index < steps.length - 1) {
    setTimeout(() => {
      executeSteps(steps, index + 1)
    }, animationSpeed.value)
  }
}

function createFlowPoint(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color = '#42b883',
) {
  // 创建流动点
  const point = {
    x: x1,
    y: y1,
    radius: 6,
    color,
    active: true,
  }

  flowPoints.value.push(point)

  // 动画流动点
  const steps = 20
  let step = 0

  const animate = () => {
    if (step <= steps) {
      const progress = step / steps
      point.x = x1 + (x2 - x1) * progress
      point.y = y1 + (y2 - y1) * progress
      step++
      requestAnimationFrame(animate)
    } else {
      // 移除流动点
      const index = flowPoints.value.indexOf(point)
      if (index > -1) {
        flowPoints.value.splice(index, 1)
      }
    }
  }

  animate()
}

function resetFlow() {
  // 重置所有状态
  resetStates()
  currentStep.value = 0
  currentStage.value = 0
  isRunning.value = false
  flowPoints.value = []

  // 重置数据
  refData.value = props.refValue
  depData.version = props.depVersion
  depData.subs = props.depSubs
  linkData.version = props.linkVersion
  effectData.flags = props.effectFlags
  effectData.deps = props.effectDeps
}

function resetStates() {
  // 重置组件状态
  Object.keys(activeComponents).forEach(key => {
    ;(activeComponents as any)[key] = false
  })

  Object.keys(highlighted).forEach(key => {
    ;(highlighted as any)[key] = false
  })

  // 重置连接线状态
  Object.keys(connections).forEach(key => {
    ;(connections as any)[key].active = false
    ;(connections as any)[key].flow = false
  })
}

// 监听 props 变化
watch(
  () => props.refValue,
  newVal => {
    refData.value = newVal
  },
)

watch(
  () => props.depVersion,
  newVal => {
    depData.version = newVal
  },
)

watch(
  () => props.depSubs,
  newVal => {
    depData.subs = newVal
  },
)

watch(
  () => props.linkVersion,
  newVal => {
    linkData.version = newVal
  },
)

watch(
  () => props.effectFlags,
  newVal => {
    effectData.flags = newVal
  },
)

watch(
  () => props.effectDeps,
  newVal => {
    effectData.deps = newVal
  },
)
</script>

<style scoped>
.advanced-reactive-flow {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  margin-top: 2rem;
}

.advanced-reactive-flow h3 {
  margin-bottom: 0.5rem;
  color: #333;
  font-size: 1.3rem;
}

.description {
  color: #666;
  margin-bottom: 1.5rem;
  font-size: 1rem;
  line-height: 1.5;
}

.flow-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.flow-controls {
  display: flex;
  gap: 2rem;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.control-group label {
  font-weight: 500;
  color: #555;
  font-size: 0.9rem;
}

.mode-select {
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.9rem;
}

.speed-slider {
  width: 100px;
}

.speed-value {
  font-size: 0.9rem;
  color: #666;
  margin-left: 0.5rem;
}

.control-buttons {
  display: flex;
  gap: 0.5rem;
}

.start-btn {
  padding: 0.5rem 1rem;
  background: #42b883;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background 0.3s;
}

.start-btn:hover:not(:disabled) {
  background: #369870;
}

.start-btn:disabled {
  background: #adb5bd;
  cursor: not-allowed;
}

.reset-btn {
  padding: 0.5rem 1rem;
  background: #f39c12;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background 0.3s;
}

.reset-btn:hover {
  background: #e67e22;
}

.flow-diagram {
  background: white;
  border-radius: 8px;
  padding: 1rem;
  border: 1px solid #e0e0e0;
  min-height: 600px;
}

.stage-area {
  fill: rgba(66, 184, 131, 0.1);
  stroke: #ddd;
  stroke-width: 1;
  transition: all 0.3s;
}

.stage-area.active {
  fill: rgba(66, 184, 131, 0.2);
  stroke: #42b883;
  stroke-width: 2;
}

.stage-title {
  fill: #42b883;
  font-weight: bold;
  font-size: 16px;
}

.component {
  cursor: pointer;
  transition: all 0.3s;
}

.component.active {
  transform: scale(1.1);
}

.component.highlight {
  filter: drop-shadow(0 0 8px rgba(66, 184, 131, 0.5));
}

.component-bg {
  fill: white;
  stroke: #ddd;
  stroke-width: 2;
  transition: all 0.3s;
}

.component.active .component-bg {
  stroke: #42b883;
  stroke-width: 3;
  fill: #e8f4f0;
}

.component.highlight .component-bg {
  stroke: #f39c12;
  stroke-width: 3;
}

.component-title {
  font-weight: bold;
  fill: #333;
  font-size: 14px;
}

.component-value {
  fill: #42b883;
  font-family: 'Monaco', 'Consolas', monospace;
  font-size: 12px;
}

.component-prop {
  fill: #666;
  font-size: 10px;
}

.connection-line {
  stroke: #999;
  stroke-width: 2;
  transition: all 0.3s;
}

.connection-line.active {
  stroke: #42b883;
  stroke-width: 3;
}

.connection-line.flow {
  stroke: #f39c12;
  stroke-width: 4;
  stroke-dasharray: 10, 5;
  animation: flow 1s linear infinite;
}

.connection-line.reverse {
  stroke: #e74c3c;
}

.connection-line.reverse.active {
  stroke: #e74c3c;
  stroke-width: 3;
}

.connection-line.reverse.flow {
  stroke: #e74c3c;
  stroke-width: 4;
  stroke-dasharray: 10, 5;
  animation: flowReverse 1s linear infinite;
}

@keyframes flow {
  to {
    stroke-dashoffset: -15;
  }
}

@keyframes flowReverse {
  to {
    stroke-dashoffset: 15;
  }
}

.flow-point {
  transition: all 0.3s;
}

.flow-point.active {
  r: 8;
}

.flow-explanation {
  background: #e9f7ef;
  border-radius: 8px;
  padding: 1rem;
  border: 1px solid #d4edda;
}

.explanation-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.explanation-header h4 {
  margin: 0;
  color: #2c6643;
  font-size: 1.1rem;
}

.stage-indicator {
  display: flex;
  gap: 0.5rem;
}

.stage-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #ddd;
  transition: all 0.3s;
}

.stage-dot.active {
  background: #42b883;
}

.stage-dot.current {
  background: #f39c12;
  transform: scale(1.2);
}

.explanation-text {
  margin: 0;
  color: #555;
  line-height: 1.5;
}

.component-details {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 1rem;
  border: 1px solid #e0e0e0;
}

.component-details h4 {
  margin-bottom: 1rem;
  color: #333;
  font-size: 1.1rem;
}

.details-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}

.detail-card {
  background: white;
  border-radius: 8px;
  padding: 1rem;
  border: 1px solid #e0e0e0;
  cursor: pointer;
  transition: all 0.3s;
}

.detail-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.detail-card.active {
  border-color: #42b883;
  background: #e8f4f0;
}

.detail-card h5 {
  margin-bottom: 0.5rem;
  color: #333;
  font-size: 1rem;
}

.detail-card p {
  color: #666;
  font-size: 0.9rem;
  line-height: 1.4;
  margin-bottom: 1rem;
}

.detail-code {
  background: #1a1a1a;
  color: #f0f0f0;
  padding: 0.75rem;
  border-radius: 4px;
  font-family: 'Monaco', 'Consolas', monospace;
  font-size: 0.8rem;
  overflow-x: auto;
}

.detail-code code {
  line-height: 1.4;
}

@media (max-width: 768px) {
  .flow-controls {
    flex-direction: column;
    align-items: stretch;
  }

  .details-grid {
    grid-template-columns: 1fr;
  }
}
</style>
