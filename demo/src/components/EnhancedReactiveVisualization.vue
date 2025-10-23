<template>
  <div class="enhanced-reactive-visualization">
    <h3>🔮 Vue 3 响应式系统深度解析</h3>
    <p class="description">
      直观展示 Ref、Dep、Link 和 ReactiveEffect 之间的依赖关系和数据流动
    </p>

    <div class="visualization-container">
      <!-- 控制面板 -->
      <div class="control-panel">
        <div class="control-group">
          <label>操作模式:</label>
          <div class="button-group">
            <button
              @click="setMode('track')"
              :class="{ active: mode === 'track' }"
              class="mode-btn"
            >
              依赖收集
            </button>
            <button
              @click="setMode('trigger')"
              :class="{ active: mode === 'trigger' }"
              class="mode-btn"
            >
              触发更新
            </button>
          </div>
        </div>
        <div class="control-group">
          <button
            @click="startAnimation"
            class="trigger-btn"
            :disabled="isAnimating"
          >
            {{ isAnimating ? '执行中...' : '开始演示' }}
          </button>
          <button @click="resetVisualization" class="reset-btn">重置</button>
        </div>
      </div>

      <!-- 主要可视化区域 -->
      <div class="main-diagram">
        <svg width="100%" height="500" viewBox="0 0 1000 500">
          <!-- 背景网格 -->
          <pattern
            id="grid"
            width="20"
            height="20"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 20 0 L 0 0 0 20"
              fill="none"
              stroke="#f0f0f0"
              stroke-width="1"
            />
          </pattern>
          <rect width="100%" height="100%" fill="url(#grid)" />

          <!-- Ref 对象 -->
          <g
            :transform="`translate(${positions.ref.x}, ${positions.ref.y})`"
            class="object-group ref-group"
            :class="{ active: activeObjects.ref, pulse: pulseObjects.ref }"
          >
            <rect
              x="-80"
              y="-60"
              width="160"
              height="120"
              rx="15"
              class="object-bg"
            />
            <text x="0" y="-35" text-anchor="middle" class="object-title">
              Ref
            </text>
            <text x="0" y="0" text-anchor="middle" class="object-value">
              "{{ refData.value }}"
            </text>
            <text x="0" y="25" text-anchor="middle" class="object-property">
              _rawValue: {{ refData.rawValue }}
            </text>
            <text x="0" y="45" text-anchor="middle" class="object-property">
              dep: Dep
            </text>
          </g>

          <!-- Dep 对象 -->
          <g
            :transform="`translate(${positions.dep.x}, ${positions.dep.y})`"
            class="object-group dep-group"
            :class="{ active: activeObjects.dep, pulse: pulseObjects.dep }"
          >
            <rect
              x="-80"
              y="-60"
              width="160"
              height="120"
              rx="15"
              class="object-bg"
            />
            <text x="0" y="-35" text-anchor="middle" class="object-title">
              Dep
            </text>
            <text x="0" y="0" text-anchor="middle" class="object-property">
              version: {{ depData.version }}
            </text>
            <text x="0" y="25" text-anchor="middle" class="object-property">
              subs: {{ depData.subsCount }}
            </text>
            <text x="0" y="45" text-anchor="middle" class="object-property">
              activeLink: Link
            </text>
          </g>

          <!-- ReactiveEffect 对象 -->
          <g
            :transform="`translate(${positions.effect.x}, ${positions.effect.y})`"
            class="object-group effect-group"
            :class="{
              active: activeObjects.effect,
              pulse: pulseObjects.effect,
            }"
          >
            <rect
              x="-100"
              y="-60"
              width="200"
              height="120"
              rx="15"
              class="object-bg"
            />
            <text x="0" y="-35" text-anchor="middle" class="object-title">
              ReactiveEffect
            </text>
            <text x="0" y="0" text-anchor="middle" class="object-property">
              flags: {{ effectData.flags }}
            </text>
            <text x="0" y="25" text-anchor="middle" class="object-property">
              deps: {{ effectData.depsCount }}
            </text>
            <text x="0" y="45" text-anchor="middle" class="object-property">
              fn: 副作用函数
            </text>
          </g>

          <!-- Link 对象 -->
          <g
            :transform="`translate(${positions.link.x}, ${positions.link.y})`"
            class="object-group link-group"
            :class="{ active: activeObjects.link, pulse: pulseObjects.link }"
          >
            <rect
              x="-80"
              y="-60"
              width="160"
              height="120"
              rx="15"
              class="object-bg"
            />
            <text x="0" y="-35" text-anchor="middle" class="object-title">
              Link
            </text>
            <text x="0" y="0" text-anchor="middle" class="object-property">
              version: {{ linkData.version }}
            </text>
            <text x="0" y="25" text-anchor="middle" class="object-property">
              sub: Effect
            </text>
            <text x="0" y="45" text-anchor="middle" class="object-property">
              dep: Dep
            </text>
          </g>

          <!-- 连接线 -->
          <!-- Ref -> Dep -->
          <line
            :x1="positions.ref.x"
            :y1="positions.ref.y + 60"
            :x2="positions.dep.x"
            :y2="positions.dep.y - 60"
            class="connection-line"
            :class="{
              active: connections.refDep.active,
              flow: connections.refDep.flow,
            }"
          />
          <polygon
            :points="`${positions.dep.x - 7},${positions.dep.y - 55} ${positions.dep.x},${positions.dep.y - 60} ${positions.dep.x + 7},${positions.dep.y - 55}`"
            class="arrow-head"
            :class="{
              active: connections.refDep.active,
              flow: connections.refDep.flow,
            }"
          />

          <!-- Dep -> Link -->
          <line
            :x1="positions.dep.x + 80"
            :y1="positions.dep.y"
            :x2="positions.link.x - 80"
            :y2="positions.link.y"
            class="connection-line"
            :class="{
              active: connections.depLink.active,
              flow: connections.depLink.flow,
            }"
          />
          <polygon
            :points="`${positions.link.x - 75},${positions.link.y - 7} ${positions.link.x - 80},${positions.link.y} ${positions.link.x - 75},${positions.link.y + 7}`"
            class="arrow-head"
            :class="{
              active: connections.depLink.active,
              flow: connections.depLink.flow,
            }"
          />

          <!-- Link -> ReactiveEffect -->
          <line
            :x1="positions.link.x"
            :y1="positions.link.y + 60"
            :x2="positions.effect.x"
            :y2="positions.effect.y - 60"
            class="connection-line"
            :class="{
              active: connections.linkEffect.active,
              flow: connections.linkEffect.flow,
            }"
          />
          <polygon
            :points="`${positions.effect.x - 7},${positions.effect.y - 55} ${positions.effect.x},${positions.effect.y - 60} ${positions.effect.x + 7},${positions.effect.y - 55}`"
            class="arrow-head"
            :class="{
              active: connections.linkEffect.active,
              flow: connections.linkEffect.flow,
            }"
          />

          <!-- 数据流动点 -->
          <circle
            v-for="(point, index) in dataFlowPoints"
            :key="index"
            :cx="point.x"
            :cy="point.y"
            r="6"
            class="data-flow-point"
            :class="{ active: point.active }"
          />
        </svg>
      </div>

      <!-- 步骤说明 -->
      <div class="step-explanation">
        <h4>当前步骤: {{ currentStep.title }}</h4>
        <p>{{ currentStep.description }}</p>
        <div class="progress-bar">
          <div
            class="progress-fill"
            :style="{ width: `${(currentStepIndex / 6) * 100}%` }"
          ></div>
        </div>
      </div>

      <!-- 详细说明 -->
      <div class="detailed-explanation">
        <div class="explanation-grid">
          <div
            v-for="(explanation, key) in explanations"
            :key="key"
            class="explanation-card"
            :class="{ active: activeExplanation === key }"
            @click="activeExplanation = key"
          >
            <h5>{{ explanation.title }}</h5>
            <p>{{ explanation.content }}</p>
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
  refRawValue: {
    type: [String, Number],
    default: '',
  },
  depVersion: {
    type: Number,
    default: 0,
  },
  depSubsCount: {
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
  effectDepsCount: {
    type: Number,
    default: 0,
  },
})

// 对象位置
const positions = reactive({
  ref: { x: 200, y: 100 },
  dep: { x: 500, y: 100 },
  link: { x: 800, y: 250 },
  effect: { x: 500, y: 400 },
})

// 对象状态数据
const refData = reactive({
  value: '' as string | number,
  rawValue: '' as string | number,
})

const depData = reactive({
  version: 0,
  subsCount: 0,
})

const linkData = reactive({
  version: 0,
})

const effectData = reactive({
  flags: 'ACTIVE | TRACKING',
  depsCount: 0,
})

// 可视化控制
const mode = ref<'track' | 'trigger'>('track')
const isAnimating = ref(false)
const activeObjects = reactive({
  ref: false,
  dep: false,
  link: false,
  effect: false,
})
const pulseObjects = reactive({
  ref: false,
  dep: false,
  link: false,
  effect: false,
})
const connections = reactive({
  refDep: { active: false, flow: false },
  depLink: { active: false, flow: false },
  linkEffect: { active: false, flow: false },
})
const dataFlowPoints = ref<Array<{ x: number; y: number; active: boolean }>>([])
const currentStepIndex = ref(0)

// 当前步骤说明
const currentStep = computed(() => {
  return (
    steps[currentStepIndex.value] || {
      title: '准备开始',
      description: '点击"开始演示"按钮开始可视化演示',
    }
  )
})

// 步骤定义
const steps = [
  { title: '准备阶段', description: '初始化响应式系统组件' },
  {
    title: '访问 Ref.value',
    description: '读取 Ref 的值时触发 getter，开始依赖收集流程',
  },
  {
    title: 'Dep.track()',
    description: 'Dep 对象收集当前活跃的 ReactiveEffect 作为订阅者',
  },
  {
    title: '创建 Link',
    description: '建立 Dep 与 ReactiveEffect 之间的连接关系',
  },
  {
    title: '修改 Ref.value',
    description: '设置 Ref 的新值时触发 setter，开始更新流程',
  },
  {
    title: 'Dep.trigger()',
    description: 'Dep 对象通知所有订阅者（Link 连接的 ReactiveEffect）',
  },
  {
    title: '执行副作用',
    description: 'ReactiveEffect 重新执行其副作用函数，完成更新',
  },
]

// 详细说明
const activeExplanation = ref('ref')
const explanations = {
  ref: {
    title: 'Ref 对象',
    content:
      'Ref 是 Vue 3 响应式系统的基础，用于包装基本类型值使其具有响应性。它包含 _rawValue（原始值）和 dep（依赖对象）属性。',
  },
  dep: {
    title: 'Dep 对象',
    content:
      'Dep（Dependency）负责管理依赖关系，跟踪哪些副作用函数依赖于当前响应式数据。它维护订阅者列表和版本号。',
  },
  link: {
    title: 'Link 对象',
    content:
      'Link 是 Dep 和 ReactiveEffect 之间的连接桥梁，形成双向链表结构，用于高效管理依赖关系。',
  },
  effect: {
    title: 'ReactiveEffect',
    content:
      'ReactiveEffect 代表一个副作用函数，如组件渲染函数或 watch 回调。它会在依赖数据变化时重新执行。',
  },
  dataflow: {
    title: '数据流动',
    content:
      'Vue 3 响应式系统通过 getter 收集依赖，通过 setter 触发更新，形成完整的数据流动闭环。',
  },
}

// 方法
function setMode(newMode: 'track' | 'trigger') {
  mode.value = newMode
}

function resetVisualization() {
  // 重置所有状态
  Object.keys(activeObjects).forEach(key => {
    ;(activeObjects as any)[key] = false
  })
  Object.keys(pulseObjects).forEach(key => {
    ;(pulseObjects as any)[key] = false
  })
  Object.keys(connections).forEach(key => {
    ;(connections as any)[key].active = false
    ;(connections as any)[key].flow = false
  })
  dataFlowPoints.value = []
  currentStepIndex.value = 0
  isAnimating.value = false
}

function startAnimation() {
  if (isAnimating.value) return
  isAnimating.value = true
  currentStepIndex.value = 0

  if (mode.value === 'track') {
    runTrackAnimation()
  } else {
    runTriggerAnimation()
  }
}

function runTrackAnimation() {
  // 步骤1: 激活 Ref
  setTimeout(() => {
    activeObjects.ref = true
    pulseObjects.ref = true
    currentStepIndex.value = 1

    setTimeout(() => {
      pulseObjects.ref = false
      connections.refDep.active = true
      connections.refDep.flow = true
      currentStepIndex.value = 2

      setTimeout(() => {
        connections.refDep.flow = false
        activeObjects.dep = true
        pulseObjects.dep = true
        currentStepIndex.value = 3

        setTimeout(() => {
          pulseObjects.dep = false
          connections.depLink.active = true
          connections.depLink.flow = true
          currentStepIndex.value = 4

          setTimeout(() => {
            connections.depLink.flow = false
            activeObjects.link = true
            pulseObjects.link = true
            currentStepIndex.value = 5

            setTimeout(() => {
              pulseObjects.link = false
              connections.linkEffect.active = true
              connections.linkEffect.flow = true
              currentStepIndex.value = 6

              setTimeout(() => {
                connections.linkEffect.flow = false
                activeObjects.effect = true
                pulseObjects.effect = true
                currentStepIndex.value = 7

                setTimeout(() => {
                  pulseObjects.effect = false
                  isAnimating.value = false
                }, 1000)
              }, 1000)
            }, 1000)
          }, 1000)
        }, 1000)
      }, 1000)
    }, 1000)
  }, 500)
}

function runTriggerAnimation() {
  // 步骤1: 激活 Ref
  setTimeout(() => {
    activeObjects.ref = true
    pulseObjects.ref = true
    currentStepIndex.value = 1

    setTimeout(() => {
      pulseObjects.ref = false
      connections.refDep.active = true
      connections.refDep.flow = true
      currentStepIndex.value = 2

      setTimeout(() => {
        connections.refDep.flow = false
        activeObjects.dep = true
        pulseObjects.dep = true
        depData.version++ // 增加版本号
        currentStepIndex.value = 3

        setTimeout(() => {
          pulseObjects.dep = false
          connections.depLink.active = true
          connections.depLink.flow = true
          currentStepIndex.value = 4

          setTimeout(() => {
            connections.depLink.flow = false
            activeObjects.link = true
            pulseObjects.link = true
            currentStepIndex.value = 5

            setTimeout(() => {
              pulseObjects.link = false
              connections.linkEffect.active = true
              connections.linkEffect.flow = true
              currentStepIndex.value = 6

              setTimeout(() => {
                connections.linkEffect.flow = false
                activeObjects.effect = true
                pulseObjects.effect = true
                currentStepIndex.value = 7

                setTimeout(() => {
                  pulseObjects.effect = false
                  isAnimating.value = false
                }, 1000)
              }, 1000)
            }, 1000)
          }, 1000)
        }, 1000)
      }, 1000)
    }, 1000)
  }, 500)
}

// 监听 props 变化并更新内部状态
watch(
  () => props.refValue,
  newVal => {
    refData.value = newVal
  },
)

watch(
  () => props.refRawValue,
  newVal => {
    refData.rawValue = newVal
  },
)

watch(
  () => props.depVersion,
  newVal => {
    depData.version = newVal
  },
)

watch(
  () => props.depSubsCount,
  newVal => {
    depData.subsCount = newVal
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
  () => props.effectDepsCount,
  newVal => {
    effectData.depsCount = newVal
  },
)

// 初始化数据
refData.value = props.refValue
refData.rawValue = props.refRawValue
depData.version = props.depVersion
depData.subsCount = props.depSubsCount
linkData.version = props.linkVersion
effectData.flags = props.effectFlags
effectData.depsCount = props.effectDepsCount
</script>

<style scoped>
.enhanced-reactive-visualization {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  margin-top: 2rem;
}

.enhanced-reactive-visualization h3 {
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

.visualization-container {
  position: relative;
}

.control-panel {
  display: flex;
  gap: 2rem;
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
  align-items: center;
  justify-content: space-between;
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

.button-group {
  display: flex;
  gap: 0.5rem;
}

.mode-btn {
  padding: 0.5rem 1rem;
  background: #e9ecef;
  color: #495057;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.3s;
}

.mode-btn.active {
  background: #42b883;
  color: white;
}

.trigger-btn {
  padding: 0.5rem 1rem;
  background: #42b883;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background 0.3s;
}

.trigger-btn:hover:not(:disabled) {
  background: #369870;
}

.trigger-btn:disabled {
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

.main-diagram {
  background: white;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1.5rem;
  border: 1px solid #e0e0e0;
  min-height: 500px;
}

.object-group {
  cursor: pointer;
  transition: all 0.3s;
}

.object-group.active {
  transform: scale(1.05);
}

.object-group.pulse {
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0% {
    transform: scale(1);
  }

  50% {
    transform: scale(1.1);
  }

  100% {
    transform: scale(1);
  }
}

.object-bg {
  fill: white;
  stroke: #ddd;
  stroke-width: 2;
  transition: all 0.3s;
}

.object-group.active .object-bg {
  stroke: #42b883;
  stroke-width: 3;
  fill: #e8f4f0;
}

.object-title {
  font-weight: bold;
  fill: #333;
  font-size: 16px;
}

.object-value {
  fill: #42b883;
  font-family: 'Monaco', 'Consolas', monospace;
  font-size: 14px;
}

.object-property {
  fill: #666;
  font-size: 12px;
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

@keyframes flow {
  to {
    stroke-dashoffset: -15;
  }
}

.arrow-head {
  fill: #999;
  transition: all 0.3s;
}

.arrow-head.active {
  fill: #42b883;
}

.arrow-head.flow {
  fill: #f39c12;
}

.data-flow-point {
  fill: #f39c12;
  transition: all 0.3s;
}

.data-flow-point.active {
  fill: #e74c3c;
  r: 8;
}

.step-explanation {
  background: #e9f7ef;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1.5rem;
  border: 1px solid #d4edda;
}

.step-explanation h4 {
  margin-bottom: 0.5rem;
  color: #2c6643;
  font-size: 1.1rem;
}

.step-explanation p {
  margin-bottom: 1rem;
  color: #555;
  line-height: 1.5;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #42b883;
  transition: width 0.5s ease;
}

.detailed-explanation {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 1rem;
  border: 1px solid #e0e0e0;
}

.explanation-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}

.explanation-card {
  background: white;
  border-radius: 8px;
  padding: 1rem;
  border: 1px solid #e0e0e0;
  cursor: pointer;
  transition: all 0.3s;
}

.explanation-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.explanation-card.active {
  border-color: #42b883;
  background: #e8f4f0;
}

.explanation-card h5 {
  margin-bottom: 0.5rem;
  color: #333;
  font-size: 1rem;
}

.explanation-card p {
  color: #666;
  font-size: 0.9rem;
  line-height: 1.4;
}

@media (max-width: 768px) {
  .control-panel {
    flex-direction: column;
    align-items: stretch;
  }

  .explanation-grid {
    grid-template-columns: 1fr;
  }
}
</style>
