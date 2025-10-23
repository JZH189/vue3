<template>
  <div class="interactive-reactive-visualization">
    <h3>🔍 Vue 3 响应式系统实时可视化</h3>
    <p class="description">
      实时展示 Ref、Dep、Link 和 ReactiveEffect 之间的动态关系
    </p>

    <div class="visualization-container">
      <!-- 控制面板 -->
      <div class="control-panel">
        <div class="control-group">
          <label>选择演示模式:</label>
          <select v-model="demoMode" class="mode-select">
            <option value="ref">Ref 演示</option>
            <option value="reactive">Reactive 演示</option>
          </select>
        </div>
        <div class="control-group">
          <button @click="triggerDataFlow" class="trigger-btn">
            触发数据流
          </button>
        </div>
        <div class="control-group">
          <label>
            <input type="checkbox" v-model="showRealTime" />
            实时更新
          </label>
        </div>
      </div>

      <!-- 可视化图表 -->
      <div class="diagram-container">
        <svg width="100%" height="600" viewBox="0 0 1000 600">
          <!-- Ref 对象 -->
          <g
            :transform="`translate(${positions.ref.x}, ${positions.ref.y})`"
            class="object-group ref-group"
            :class="{ active: activeObject === 'ref' }"
            @click="selectObject('ref')"
          >
            <rect
              x="-70"
              y="-50"
              width="140"
              height="100"
              rx="10"
              class="object-bg"
            />
            <text x="0" y="-25" text-anchor="middle" class="object-title">
              Ref
            </text>
            <text x="0" y="5" text-anchor="middle" class="object-value">
              "{{ refData.value }}"
            </text>
            <text x="0" y="25" text-anchor="middle" class="object-property">
              dep: Dep
            </text>
            <text x="0" y="40" text-anchor="middle" class="object-property">
              _rawValue: {{ refData.rawValue }}
            </text>
          </g>

          <!-- Dep 对象 -->
          <g
            :transform="`translate(${positions.dep.x}, ${positions.dep.y})`"
            class="object-group dep-group"
            :class="{ active: activeObject === 'dep' }"
            @click="selectObject('dep')"
          >
            <rect
              x="-70"
              y="-50"
              width="140"
              height="100"
              rx="10"
              class="object-bg"
            />
            <text x="0" y="-25" text-anchor="middle" class="object-title">
              Dep
            </text>
            <text x="0" y="5" text-anchor="middle" class="object-property">
              version: {{ depData.version }}
            </text>
            <text x="0" y="25" text-anchor="middle" class="object-property">
              subs: {{ depData.subsCount }}
            </text>
            <text x="0" y="40" text-anchor="middle" class="object-property">
              activeLink: Link
            </text>
          </g>

          <!-- Link 对象 -->
          <g
            :transform="`translate(${positions.link.x}, ${positions.link.y})`"
            class="object-group link-group"
            :class="{ active: activeObject === 'link' }"
            @click="selectObject('link')"
          >
            <rect
              x="-70"
              y="-50"
              width="140"
              height="100"
              rx="10"
              class="object-bg"
            />
            <text x="0" y="-25" text-anchor="middle" class="object-title">
              Link
            </text>
            <text x="0" y="5" text-anchor="middle" class="object-property">
              version: {{ linkData.version }}
            </text>
            <text x="0" y="25" text-anchor="middle" class="object-property">
              sub: Effect
            </text>
            <text x="0" y="40" text-anchor="middle" class="object-property">
              dep: Dep
            </text>
          </g>

          <!-- ReactiveEffect 对象 -->
          <g
            :transform="`translate(${positions.effect.x}, ${positions.effect.y})`"
            class="object-group effect-group"
            :class="{ active: activeObject === 'effect' }"
            @click="selectObject('effect')"
          >
            <rect
              x="-80"
              y="-50"
              width="160"
              height="100"
              rx="10"
              class="object-bg"
            />
            <text x="0" y="-25" text-anchor="middle" class="object-title">
              ReactiveEffect
            </text>
            <text x="0" y="5" text-anchor="middle" class="object-property">
              flags: {{ effectData.flags }}
            </text>
            <text x="0" y="25" text-anchor="middle" class="object-property">
              deps: {{ effectData.depsCount }}
            </text>
            <text x="0" y="40" text-anchor="middle" class="object-property">
              fn: 副作用函数
            </text>
          </g>

          <!-- 连接线 -->
          <!-- Ref -> Dep -->
          <line
            :x1="positions.ref.x"
            :y1="positions.ref.y + 50"
            :x2="positions.dep.x"
            :y2="positions.dep.y - 50"
            class="connection-line"
            :class="{ active: connectionActive.refDep }"
          />
          <polygon
            :points="`${positions.dep.x - 5},${positions.dep.y - 45} ${positions.dep.x},${positions.dep.y - 50} ${positions.dep.x + 5},${positions.dep.y - 45}`"
            class="arrow-head"
            :class="{ active: connectionActive.refDep }"
          />

          <!-- Dep -> Link -->
          <line
            :x1="positions.dep.x + 70"
            :y1="positions.dep.y"
            :x2="positions.link.x - 70"
            :y2="positions.link.y"
            class="connection-line"
            :class="{ active: connectionActive.depLink }"
          />
          <polygon
            :points="`${positions.link.x - 65},${positions.link.y - 5} ${positions.link.x - 70},${positions.link.y} ${positions.link.x - 65},${positions.link.y + 5}`"
            class="arrow-head"
            :class="{ active: connectionActive.depLink }"
          />

          <!-- Link -> ReactiveEffect -->
          <line
            :x1="positions.link.x"
            :y1="positions.link.y + 50"
            :x2="positions.effect.x"
            :y2="positions.effect.y - 50"
            class="connection-line"
            :class="{ active: connectionActive.linkEffect }"
          />
          <polygon
            :points="`${positions.effect.x - 5},${positions.effect.y - 45} ${positions.effect.x},${positions.effect.y - 50} ${positions.effect.x + 5},${positions.effect.y - 45}`"
            class="arrow-head"
            :class="{ active: connectionActive.linkEffect }"
          />

          <!-- ReactiveEffect -> Link (反向) -->
          <line
            :x1="positions.effect.x - 80"
            :y1="positions.effect.y"
            :x2="positions.link.x + 70"
            :y2="positions.link.y"
            class="connection-line reverse"
            :class="{ active: connectionActive.effectLink }"
          />
          <polygon
            :points="`${positions.link.x + 65},${positions.link.y - 5} ${positions.link.x + 70},${positions.link.y} ${positions.link.x + 65},${positions.link.y + 5}`"
            class="arrow-head reverse"
            :class="{ active: connectionActive.effectLink }"
          />

          <!-- Link -> Dep (反向) -->
          <line
            :x1="positions.link.x"
            :y1="positions.link.y - 50"
            :x2="positions.dep.x"
            :y2="positions.dep.y + 50"
            class="connection-line reverse"
            :class="{ active: connectionActive.linkDep }"
          />
          <polygon
            :points="`${positions.dep.x - 5},${positions.dep.y + 45} ${positions.dep.x},${positions.dep.y + 50} ${positions.dep.x + 5},${positions.dep.y + 45}`"
            class="arrow-head reverse"
            :class="{ active: connectionActive.linkDep }"
          />

          <!-- Dep -> Ref (反向) -->
          <line
            :x1="positions.dep.x"
            :y1="positions.dep.y - 50"
            :x2="positions.ref.x"
            :y2="positions.ref.y + 50"
            class="connection-line reverse"
            :class="{ active: connectionActive.depRef }"
          />
          <polygon
            :points="`${positions.ref.x - 5},${positions.ref.y + 45} ${positions.ref.x},${positions.ref.y + 50} ${positions.ref.x + 5},${positions.ref.y + 45}`"
            class="arrow-head reverse"
            :class="{ active: connectionActive.depRef }"
          />

          <!-- 数据流动动画 -->
          <circle
            v-if="dataFlow.active"
            :cx="dataFlow.position.x"
            :cy="dataFlow.position.y"
            r="6"
            class="data-flow-point"
          />
        </svg>
      </div>

      <!-- 对象详情 -->
      <div class="object-details" v-if="activeObject">
        <h4>{{ getObjectTitle(activeObject) }} 详情</h4>
        <div class="details-content">
          <div
            v-for="(value, key) in getObjectDetails(activeObject)"
            :key="key"
            class="detail-item"
          >
            <span class="detail-key">{{ key }}:</span>
            <span class="detail-value">{{ value }}</span>
          </div>
        </div>
      </div>

      <!-- 数据流说明 -->
      <div class="dataflow-explanation">
        <h4>数据流动说明</h4>
        <div class="explanation-steps">
          <div
            v-for="(step, index) in dataFlowSteps"
            :key="index"
            class="step"
            :class="{ active: currentStep === index + 1 }"
          >
            <div class="step-header">
              <span class="step-number">{{ index + 1 }}</span>
              <span class="step-title">{{ step.title }}</span>
            </div>
            <div class="step-description">{{ step.description }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue'

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
  link: { x: 800, y: 300 },
  effect: { x: 500, y: 500 },
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
const activeObject = ref<string | null>(null)
const demoMode = ref('ref')
const showRealTime = ref(true)
const currentStep = ref(0)
const dataFlow = reactive({
  active: false,
  position: { x: 0, y: 0 },
})

// 连接线激活状态
const connectionActive = reactive({
  refDep: false,
  depLink: false,
  linkEffect: false,
  effectLink: false,
  linkDep: false,
  depRef: false,
})

// 数据流步骤
const dataFlowSteps = [
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

// 监听 props 变化并更新内部状态
watch(
  () => props.refValue,
  newVal => {
    refData.value = newVal
    if (showRealTime.value) {
      // 模拟数据流步骤
      simulateDataFlow(1)
    }
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

// 方法
function selectObject(object: string) {
  activeObject.value = object
}

function getObjectTitle(object: string) {
  const titles: Record<string, string> = {
    ref: 'Ref 对象',
    dep: 'Dep 对象',
    link: 'Link 对象',
    effect: 'ReactiveEffect 对象',
  }
  return titles[object] || object
}

function getObjectDetails(object: string) {
  const details: Record<string, Record<string, any>> = {
    ref: {
      类型: 'RefImpl<T>',
      属性: 'value, dep, _rawValue, _value',
      作用: '包装值以实现响应式',
      当前值: refData.value,
      原始值: refData.rawValue,
    },
    dep: {
      类型: 'Dep',
      属性: 'version, subs, activeLink',
      作用: '管理订阅者和依赖关系',
      版本号: depData.version,
      订阅者数: depData.subsCount,
    },
    link: {
      类型: 'Link',
      属性: 'version, sub, dep, prev/next指针',
      作用: '连接 Dep 和 Subscriber',
      版本号: linkData.version,
    },
    effect: {
      类型: 'ReactiveEffect',
      属性: 'flags, deps, fn',
      作用: '执行副作用函数',
      标志位: effectData.flags,
      依赖数: effectData.depsCount,
    },
  }
  return details[object] || {}
}

function triggerDataFlow() {
  // 模拟手动触发数据流
  simulateDataFlow(4) // 修改 Ref.value
}

function simulateDataFlow(startStep: number) {
  currentStep.value = startStep

  // 激活相应的连接线
  activateConnections(startStep)

  // 模拟数据流动画
  if (startStep === 1) {
    // 从 Ref 到 Dep
    animateDataFlow(positions.ref, positions.dep, () => {
      currentStep.value = 2
      activateConnections(2)

      // 从 Dep 到 Link
      setTimeout(() => {
        animateDataFlow(positions.dep, positions.link, () => {
          currentStep.value = 3
          activateConnections(3)

          // 重置
          setTimeout(() => {
            resetConnections()
            currentStep.value = 0
          }, 1000)
        })
      }, 500)
    })
  } else if (startStep === 4) {
    // 从 Ref 到 Dep
    animateDataFlow(positions.ref, positions.dep, () => {
      depData.version++
      currentStep.value = 5
      activateConnections(5)

      // 从 Dep 到 Link
      setTimeout(() => {
        animateDataFlow(positions.dep, positions.link, () => {
          currentStep.value = 6
          activateConnections(6)

          // 从 Link 到 Effect
          setTimeout(() => {
            animateDataFlow(positions.link, positions.effect, () => {
              // 重置
              setTimeout(() => {
                resetConnections()
                currentStep.value = 0
              }, 1000)
            })
          }, 500)
        })
      }, 500)
    })
  } else if (startStep === 5) {
    // 从 Dep 到 Link
    animateDataFlow(positions.dep, positions.link, () => {
      currentStep.value = 6
      activateConnections(6)

      // 从 Link 到 Effect
      setTimeout(() => {
        animateDataFlow(positions.link, positions.effect, () => {
          // 重置
          setTimeout(() => {
            resetConnections()
            currentStep.value = 0
          }, 1000)
        })
      }, 500)
    })
  }
}

function activateConnections(step: number) {
  // 重置所有连接
  resetConnections()

  // 根据步骤激活相应连接
  switch (step) {
    case 1: // 访问 Ref.value
      connectionActive.refDep = true
      break
    case 2: // Dep.track()
      connectionActive.depLink = true
      break
    case 3: // 创建 Link
      connectionActive.linkEffect = true
      break
    case 4: // 修改 Ref.value
      connectionActive.refDep = true
      break
    case 5: // Dep.trigger()
      connectionActive.depLink = true
      connectionActive.linkEffect = true
      break
    case 6: // 执行副作用
      connectionActive.effectLink = true
      connectionActive.linkDep = true
      connectionActive.depRef = true
      break
  }
}

function resetConnections() {
  Object.keys(connectionActive).forEach(key => {
    ;(connectionActive as any)[key] = false
  })
}

function animateDataFlow(
  start: { x: number; y: number },
  end: { x: number; y: number },
  callback: () => void,
) {
  dataFlow.active = true
  const steps = 20
  let step = 0

  const animate = () => {
    if (step <= steps) {
      const progress = step / steps
      dataFlow.position.x = start.x + (end.x - start.x) * progress
      dataFlow.position.y = start.y + (end.y - start.y) * progress
      step++
      requestAnimationFrame(animate)
    } else {
      dataFlow.active = false
      callback()
    }
  }

  animate()
}

// 组件挂载和卸载
onMounted(() => {
  // 初始化数据
  refData.value = props.refValue
  refData.rawValue = props.refRawValue
  depData.version = props.depVersion
  depData.subsCount = props.depSubsCount
  linkData.version = props.linkVersion
  effectData.flags = props.effectFlags
  effectData.depsCount = props.effectDepsCount

  // 初始化时显示第一步
  setTimeout(() => {
    currentStep.value = 1
    activateConnections(1)

    setTimeout(() => {
      currentStep.value = 2
      activateConnections(2)

      setTimeout(() => {
        currentStep.value = 3
        activateConnections(3)

        setTimeout(() => {
          resetConnections()
          currentStep.value = 0
        }, 1000)
      }, 1000)
    }, 1000)
  }, 1000)
})

onUnmounted(() => {
  // 清理工作
})
</script>

<style scoped>
.interactive-reactive-visualization {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  margin-top: 2rem;
}

.interactive-reactive-visualization h3 {
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
  gap: 1rem;
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
  align-items: end;
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

.trigger-btn:hover {
  background: #369870;
}

.diagram-container {
  background: #fafafa;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1.5rem;
  border: 1px solid #e0e0e0;
  min-height: 600px;
}

.object-group {
  cursor: pointer;
  transition: transform 0.2s;
}

.object-group:hover {
  transform: scale(1.05);
}

.object-group.active {
  transform: scale(1.1);
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
  font-size: 14px;
}

.object-value {
  fill: #42b883;
  font-family: 'Monaco', 'Consolas', monospace;
  font-size: 12px;
}

.object-property {
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
  stroke-dasharray: 5, 5;
  animation: flow 1s linear infinite;
}

.connection-line.reverse {
  stroke: #e74c3c;
}

.connection-line.reverse.active {
  stroke: #e74c3c;
  stroke-width: 3;
  stroke-dasharray: 5, 5;
  animation: flowReverse 1s linear infinite;
}

.arrow-head {
  fill: #999;
  transition: all 0.3s;
}

.arrow-head.active {
  fill: #42b883;
}

.arrow-head.reverse {
  fill: #e74c3c;
}

.arrow-head.reverse.active {
  fill: #e74c3c;
}

.data-flow-point {
  fill: #f39c12;
  transition: all 0.3s;
}

@keyframes flow {
  to {
    stroke-dashoffset: -10;
  }
}

@keyframes flowReverse {
  to {
    stroke-dashoffset: 10;
  }
}

.object-details {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1.5rem;
  border: 1px solid #e0e0e0;
}

.object-details h4 {
  margin-bottom: 0.75rem;
  color: #333;
  font-size: 1.1rem;
}

.details-content {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.75rem;
}

.detail-item {
  display: flex;
  flex-direction: column;
}

.detail-key {
  font-weight: 500;
  color: #555;
  font-size: 0.9rem;
}

.detail-value {
  font-family: 'Monaco', 'Consolas', monospace;
  font-size: 0.85rem;
  color: #333;
  background: white;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  border: 1px solid #e0e0e0;
}

.dataflow-explanation {
  background: #e9f7ef;
  border-radius: 8px;
  padding: 1rem;
  border: 1px solid #d4edda;
}

.dataflow-explanation h4 {
  margin-bottom: 1rem;
  color: #2c6643;
  font-size: 1.1rem;
}

.explanation-steps {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}

.step {
  background: white;
  border-radius: 8px;
  padding: 1rem;
  border: 1px solid #d4edda;
  transition: all 0.3s;
}

.step.active {
  border-color: #42b883;
  box-shadow: 0 0 0 2px rgba(66, 184, 131, 0.2);
  transform: translateY(-3px);
}

.step-header {
  display: flex;
  align-items: center;
  margin-bottom: 0.5rem;
}

.step-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: #42b883;
  color: white;
  border-radius: 50%;
  font-weight: bold;
  font-size: 0.8rem;
  margin-right: 0.75rem;
}

.step-title {
  font-weight: 600;
  color: #333;
  font-size: 1rem;
}

.step-description {
  color: #555;
  font-size: 0.9rem;
  line-height: 1.4;
}

@media (max-width: 768px) {
  .control-panel {
    flex-direction: column;
    align-items: stretch;
  }

  .explanation-steps {
    grid-template-columns: 1fr;
  }
}
</style>
