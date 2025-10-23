<template>
  <div class="reactive-visualization">
    <h3>🔍 响应式系统核心关系可视化</h3>
    <div class="visualization-container">
      <!-- Ref 对象 -->
      <div class="ref-section">
        <div class="ref-object" :class="{ active: isActiveRef }">
          <div class="ref-header">
            <span class="ref-icon">🔵</span>
            <span class="ref-label">Ref 对象</span>
          </div>
          <div class="ref-content">
            <div class="ref-property">
              <span class="property-name">value:</span>
              <span class="property-value">{{ refValue }}</span>
            </div>
            <div class="ref-property">
              <span class="property-name">dep:</span>
              <span class="property-value dep-link" @click="selectDep"
                >Dep实例</span
              >
            </div>
            <div class="ref-property">
              <span class="property-name">_rawValue:</span>
              <span class="property-value">{{ refRawValue }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Dep 对象 -->
      <div class="dep-section">
        <div
          class="dep-object"
          :class="{ active: isActiveDep }"
          @click="selectDep"
        >
          <div class="dep-header">
            <span class="dep-icon">🔗</span>
            <span class="dep-label">Dep 实例</span>
          </div>
          <div class="dep-content">
            <div class="dep-property">
              <span class="property-name">version:</span>
              <span class="property-value">{{ depVersion }}</span>
            </div>
            <div class="dep-property">
              <span class="property-name">subs:</span>
              <span class="property-value">{{ depSubsCount }} 个订阅者</span>
            </div>
            <div class="dep-property">
              <span class="property-name">activeLink:</span>
              <span class="property-value link-ref" @click="selectActiveLink"
                >Link实例</span
              >
            </div>
          </div>
        </div>
      </div>

      <!-- Link 对象 -->
      <div class="link-section">
        <div
          class="link-object"
          :class="{ active: isActiveLink }"
          @click="selectActiveLink"
        >
          <div class="link-header">
            <span class="link-icon">⛓️</span>
            <span class="link-label">Link 实例</span>
          </div>
          <div class="link-content">
            <div class="link-property">
              <span class="property-name">version:</span>
              <span class="property-value">{{ linkVersion }}</span>
            </div>
            <div class="link-property">
              <span class="property-name">sub:</span>
              <span class="property-value effect-ref" @click="selectEffect"
                >ReactiveEffect</span
              >
            </div>
            <div class="link-property">
              <span class="property-name">dep:</span>
              <span class="property-value dep-ref" @click="selectDep"
                >Dep实例</span
              >
            </div>
          </div>
        </div>
      </div>

      <!-- ReactiveEffect 对象 -->
      <div class="effect-section">
        <div
          class="effect-object"
          :class="{ active: isActiveEffect }"
          @click="selectEffect"
        >
          <div class="effect-header">
            <span class="effect-icon">⚡</span>
            <span class="effect-label">ReactiveEffect</span>
          </div>
          <div class="effect-content">
            <div class="effect-property">
              <span class="property-name">flags:</span>
              <span class="property-value">{{ effectFlags }}</span>
            </div>
            <div class="effect-property">
              <span class="property-name">deps:</span>
              <span class="property-value">{{ effectDepsCount }} 个依赖</span>
            </div>
            <div class="effect-property">
              <span class="property-name">fn:</span>
              <span class="property-value">副作用函数</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 关系连接线 -->
      <svg class="connections" width="100%" height="100%">
        <!-- Ref -> Dep -->
        <line
          x1="150"
          y1="100"
          x2="400"
          y2="100"
          class="connection-line"
          :class="{ active: isActiveRef || isActiveDep }"
        />
        <polygon
          points="390,95 400,100 390,105"
          class="arrow-head"
          :class="{ active: isActiveRef || isActiveDep }"
        />

        <!-- Dep -> Link -->
        <line
          x1="450"
          y1="100"
          x2="450"
          y2="250"
          class="connection-line"
          :class="{ active: isActiveDep || isActiveLink }"
        />
        <polygon
          points="445,240 450,250 455,240"
          class="arrow-head"
          :class="{ active: isActiveDep || isActiveLink }"
        />

        <!-- Link -> ReactiveEffect -->
        <line
          x1="450"
          y1="300"
          x2="700"
          y2="300"
          class="connection-line"
          :class="{ active: isActiveLink || isActiveEffect }"
        />
        <polygon
          points="690,295 700,300 690,305"
          class="arrow-head"
          :class="{ active: isActiveLink || isActiveEffect }"
        />

        <!-- 反向依赖关系 -->
        <line
          x1="700"
          y1="350"
          x2="450"
          y2="350"
          class="connection-line reverse"
          :class="{ active: isActiveEffect || isActiveLink }"
        />
        <polygon
          points="460,345 450,350 460,355"
          class="arrow-head reverse"
          :class="{ active: isActiveEffect || isActiveLink }"
        />

        <line
          x1="450"
          y1="350"
          x2="450"
          y2="200"
          class="connection-line reverse"
          :class="{ active: isActiveLink || isActiveDep }"
        />
        <polygon
          points="445,210 450,200 455,210"
          class="arrow-head reverse"
          :class="{ active: isActiveLink || isActiveDep }"
        />

        <line
          x1="400"
          y1="150"
          x2="150"
          y2="150"
          class="connection-line reverse"
          :class="{ active: isActiveDep || isActiveRef }"
        />
        <polygon
          points="160,145 150,150 160,155"
          class="arrow-head reverse"
          :class="{ active: isActiveDep || isActiveRef }"
        />
      </svg>
    </div>

    <!-- 交互说明 -->
    <div class="interaction-info">
      <h4>交互说明</h4>
      <ul>
        <li>点击对象可高亮显示其属性和关系</li>
        <li>点击引用链接可跳转到相关对象</li>
        <li>高亮的连接线表示当前活跃的数据流</li>
        <li>实线表示正向依赖关系，虚线表示反向通知关系</li>
      </ul>
    </div>

    <!-- 数据流说明 -->
    <div class="dataflow-info">
      <h4>数据流动过程</h4>
      <div class="dataflow-steps">
        <div class="step" :class="{ active: currentStep === 1 }">
          <span class="step-number">1</span>
          <span class="step-desc">访问 Ref.value 触发 getter</span>
        </div>
        <div class="step" :class="{ active: currentStep === 2 }">
          <span class="step-number">2</span>
          <span class="step-desc">Dep.track() 收集当前 ReactiveEffect</span>
        </div>
        <div class="step" :class="{ active: currentStep === 3 }">
          <span class="step-number">3</span>
          <span class="step-desc">创建 Link 建立 Dep 与 Effect 的连接</span>
        </div>
        <div class="step" :class="{ active: currentStep === 4 }">
          <span class="step-number">4</span>
          <span class="step-desc">修改 Ref.value 触发 setter</span>
        </div>
        <div class="step" :class="{ active: currentStep === 5 }">
          <span class="step-number">5</span>
          <span class="step-desc">Dep.trigger() 通知所有订阅者</span>
        </div>
        <div class="step" :class="{ active: currentStep === 6 }">
          <span class="step-number">6</span>
          <span class="step-desc">ReactiveEffect 重新执行副作用函数</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

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
  currentStep: {
    type: Number,
    default: 0,
  },
})

// 状态管理
const isActiveRef = ref(false)
const isActiveDep = ref(false)
const isActiveLink = ref(false)
const isActiveEffect = ref(false)

// 事件
const emit = defineEmits(['selectDep', 'selectLink', 'selectEffect'])

// 方法
function selectDep() {
  resetActiveStates()
  isActiveDep.value = true
  emit('selectDep')
}

function selectActiveLink() {
  resetActiveStates()
  isActiveLink.value = true
  emit('selectLink')
}

function selectEffect() {
  resetActiveStates()
  isActiveEffect.value = true
  emit('selectEffect')
}

function resetActiveStates() {
  isActiveRef.value = false
  isActiveDep.value = false
  isActiveLink.value = false
  isActiveEffect.value = false
}

// 计算属性
const formattedEffectFlags = computed(() => {
  return props.effectFlags
})
</script>

<style scoped>
.reactive-visualization {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  margin-top: 2rem;
}

.reactive-visualization h3 {
  margin-bottom: 1rem;
  color: #333;
  font-size: 1.3rem;
}

.visualization-container {
  position: relative;
  height: 400px;
  background: #f8f9fa;
  border-radius: 8px;
  padding: 2rem;
  overflow: hidden;
}

/* 对象样式 */
.ref-object,
.dep-object,
.link-object,
.effect-object {
  position: absolute;
  background: white;
  border-radius: 8px;
  border: 2px solid #e0e0e0;
  padding: 1rem;
  width: 200px;
  transition: all 0.3s ease;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.ref-object {
  top: 50px;
  left: 50px;
}

.dep-object {
  top: 50px;
  left: 300px;
}

.link-object {
  top: 200px;
  left: 300px;
}

.effect-object {
  top: 200px;
  left: 550px;
}

.ref-object.active,
.dep-object.active,
.link-object.active,
.effect-object.active {
  border-color: #42b883;
  box-shadow: 0 0 0 3px rgba(66, 184, 131, 0.3);
  transform: scale(1.05);
}

/* 对象头部 */
.ref-header,
.dep-header,
.link-header,
.effect-header {
  display: flex;
  align-items: center;
  margin-bottom: 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #eee;
}

.ref-icon,
.dep-icon,
.link-icon,
.effect-icon {
  font-size: 1.2rem;
  margin-right: 0.5rem;
}

.ref-label,
.dep-label,
.link-label,
.effect-label {
  font-weight: bold;
  color: #333;
}

/* 对象内容 */
.ref-content,
.dep-content,
.link-content,
.effect-content {
  font-size: 0.9rem;
}

.ref-property,
.dep-property,
.link-property,
.effect-property {
  margin-bottom: 0.5rem;
  display: flex;
  justify-content: space-between;
}

.property-name {
  font-weight: 500;
  color: #555;
}

.property-value {
  font-family: 'Monaco', 'Consolas', monospace;
  background: #f1f3f4;
  padding: 0.125rem 0.25rem;
  border-radius: 3px;
  font-size: 0.8rem;
}

/* 引用链接样式 */
.dep-link,
.link-ref,
.effect-ref,
.dep-ref {
  color: #42b883;
  cursor: pointer;
  text-decoration: underline;
}

.dep-link:hover,
.link-ref:hover,
.effect-ref:hover,
.dep-ref:hover {
  background: rgba(66, 184, 131, 0.1);
}

/* 连接线 */
.connections {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
}

.connection-line {
  stroke: #999;
  stroke-width: 2;
  fill: none;
}

.connection-line.active {
  stroke: #42b883;
  stroke-width: 3;
}

.connection-line.reverse {
  stroke-dasharray: 5, 5;
}

.arrow-head {
  fill: #999;
}

.arrow-head.active {
  fill: #42b883;
}

.arrow-head.reverse {
  fill: #e74c3c;
}

/* 交互说明 */
.interaction-info {
  margin-top: 1.5rem;
  background: #e9f7ef;
  border-radius: 8px;
  padding: 1rem;
}

.interaction-info h4 {
  margin-bottom: 0.5rem;
  color: #2c6643;
}

.interaction-info ul {
  margin: 0;
  padding-left: 1.5rem;
}

.interaction-info li {
  margin-bottom: 0.25rem;
  color: #333;
  font-size: 0.9rem;
}

/* 数据流说明 */
.dataflow-info {
  margin-top: 1.5rem;
}

.dataflow-info h4 {
  margin-bottom: 1rem;
  color: #333;
}

.dataflow-steps {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.step {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 0.75rem;
  border: 1px solid #e0e0e0;
  flex: 1;
  min-width: 200px;
  transition: all 0.3s ease;
}

.step.active {
  background: #d4edda;
  border-color: #42b883;
  transform: translateY(-3px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.step-number {
  display: inline-block;
  width: 24px;
  height: 24px;
  background: #42b883;
  color: white;
  border-radius: 50%;
  text-align: center;
  line-height: 24px;
  font-weight: bold;
  margin-right: 0.5rem;
}

.step-desc {
  color: #333;
  font-size: 0.9rem;
}
</style>
