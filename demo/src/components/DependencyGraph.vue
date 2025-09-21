<template>
  <div class="dependency-graph">
    <h2>🕸️ 依赖关系图</h2>
    <p class="description">
      可视化展示Vue 3响应式系统中数据、计算属性和副作用之间的依赖关系
    </p>

    <div class="graph-controls">
      <div class="control-group">
        <button @click="addDataNode" class="add-btn data-btn">
          添加数据节点
        </button>
        <button @click="addComputedNode" class="add-btn computed-btn">
          添加计算属性
        </button>
        <button @click="addEffectNode" class="add-btn effect-btn">
          添加副作用
        </button>
      </div>

      <div class="control-group">
        <button @click="clearGraph" class="clear-btn">清空图表</button>
        <button @click="autoLayout" class="layout-btn">自动布局</button>
        <label class="animation-control">
          <input type="checkbox" v-model="enableAnimation" />
          启用动画
        </label>
      </div>
    </div>

    <div class="graph-container" ref="graphContainer">
      <svg
        :width="svgWidth"
        :height="svgHeight"
        @mousedown="onSvgMouseDown"
        @mousemove="onSvgMouseMove"
        @mouseup="onSvgMouseUp"
      >
        <!-- 依赖连线 -->
        <g class="dependencies">
          <line
            v-for="edge in edges"
            :key="`${edge.from}-${edge.to}`"
            :x1="nodes[edge.from]?.x || 0"
            :y1="nodes[edge.from]?.y || 0"
            :x2="nodes[edge.to]?.x || 0"
            :y2="nodes[edge.to]?.y || 0"
            :class="['dependency-line', edge.type]"
            :stroke-width="edge.active ? 3 : 1"
          />

          <!-- 箭头标记 -->
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="10"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="#666" />
            </marker>
          </defs>
        </g>

        <!-- 节点 -->
        <g class="nodes">
          <g
            v-for="node in Object.values(nodes)"
            :key="node.id"
            :transform="`translate(${node.x}, ${node.y})`"
            :class="['node', node.type, { active: node.active }]"
            @mousedown="startDrag(node, $event)"
            @click="selectNode(node)"
          >
            <!-- 节点背景 -->
            <circle :r="node.radius" :class="['node-bg', node.type]" />

            <!-- 节点图标 -->
            <text
              :class="['node-icon', node.type]"
              text-anchor="middle"
              dy="0.3em"
            >
              {{ getNodeIcon(node.type) }}
            </text>

            <!-- 节点标签 -->
            <text
              :class="['node-label', node.type]"
              text-anchor="middle"
              :dy="node.radius + 15"
            >
              {{ node.label }}
            </text>

            <!-- 值显示 -->
            <text
              v-if="node.value !== undefined"
              :class="['node-value', node.type]"
              text-anchor="middle"
              :dy="node.radius + 30"
            >
              {{ formatValue(node.value) }}
            </text>
          </g>
        </g>

        <!-- 激活路径高亮 -->
        <g v-if="selectedNode" class="activation-path">
          <circle
            v-for="nodeId in getActivationPath(selectedNode.id)"
            :key="`highlight-${nodeId}`"
            :cx="nodes[nodeId]?.x || 0"
            :cy="nodes[nodeId]?.y || 0"
            :r="nodes[nodeId]?.radius + 5"
            class="path-highlight"
          />
        </g>
      </svg>
    </div>

    <!-- 节点信息面板 -->
    <div v-if="selectedNode" class="info-panel">
      <h3>📋 节点信息</h3>
      <div class="node-info">
        <div class="info-item">
          <span class="info-label">类型:</span>
          <span class="info-value">{{
            getNodeTypeName(selectedNode.type)
          }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">标识:</span>
          <span class="info-value">{{ selectedNode.label }}</span>
        </div>
        <div v-if="selectedNode.value !== undefined" class="info-item">
          <span class="info-label">当前值:</span>
          <span class="info-value">{{ formatValue(selectedNode.value) }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">依赖数量:</span>
          <span class="info-value">{{
            getDependenciesCount(selectedNode.id)
          }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">订阅者数量:</span>
          <span class="info-value">{{
            getSubscribersCount(selectedNode.id)
          }}</span>
        </div>
      </div>

      <div class="node-actions">
        <button @click="triggerNode(selectedNode.id)" class="trigger-btn">
          触发更新
        </button>
        <button @click="removeNode(selectedNode.id)" class="remove-btn">
          删除节点
        </button>
      </div>
    </div>

    <!-- 图例 -->
    <div class="legend">
      <h3>📊 图例说明</h3>
      <div class="legend-items">
        <div class="legend-item">
          <div class="legend-node data"></div>
          <span>响应式数据</span>
        </div>
        <div class="legend-item">
          <div class="legend-node computed"></div>
          <span>计算属性</span>
        </div>
        <div class="legend-item">
          <div class="legend-node effect"></div>
          <span>副作用</span>
        </div>
        <div class="legend-item">
          <div class="legend-line"></div>
          <span>依赖关系</span>
        </div>
      </div>
    </div>

    <!-- 实时数据操作 -->
    <div class="data-operations">
      <h3>🎮 实时数据操作</h3>
      <div class="operations-grid">
        <div
          v-for="dataNode in dataNodes"
          :key="dataNode.id"
          class="operation-item"
        >
          <label>{{ dataNode.label }}:</label>
          <div class="value-controls">
            <input
              v-if="dataNode.valueType === 'number'"
              type="number"
              :value="dataNode.value"
              @input="updateNodeValue(dataNode.id, $event.target.value)"
              class="value-input"
            />
            <input
              v-else-if="dataNode.valueType === 'string'"
              type="text"
              :value="dataNode.value"
              @input="updateNodeValue(dataNode.id, $event.target.value)"
              class="value-input"
            />
            <button
              v-else-if="dataNode.valueType === 'boolean'"
              @click="toggleNodeValue(dataNode.id)"
              :class="['toggle-btn', { active: dataNode.value }]"
            >
              {{ dataNode.value ? 'True' : 'False' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, nextTick } from 'vue'

interface GraphNode {
  id: string
  type: 'data' | 'computed' | 'effect'
  label: string
  x: number
  y: number
  radius: number
  active: boolean
  value?: any
  valueType?: 'number' | 'string' | 'boolean'
  computeFn?: () => any
}

interface GraphEdge {
  from: string
  to: string
  type: 'dependency' | 'subscription'
  active: boolean
}

// 图形状态
const svgWidth = ref(800)
const svgHeight = ref(600)
const nodes = reactive<Record<string, GraphNode>>({})
const edges = reactive<GraphEdge[]>([])
const selectedNode = ref<GraphNode | null>(null)
const enableAnimation = ref(true)

// 拖拽状态
const isDragging = ref(false)
const dragNode = ref<GraphNode | null>(null)
const dragOffset = reactive({ x: 0, y: 0 })

const graphContainer = ref<HTMLElement>()

let nodeIdCounter = 1

// 计算属性
const dataNodes = computed(() =>
  Object.values(nodes).filter(node => node.type === 'data'),
)

const computedNodes = computed(() =>
  Object.values(nodes).filter(node => node.type === 'computed'),
)

const effectNodes = computed(() =>
  Object.values(nodes).filter(node => node.type === 'effect'),
)

// 节点操作
function addDataNode() {
  const id = `data_${nodeIdCounter++}`
  const node: GraphNode = {
    id,
    type: 'data',
    label: `数据${nodeIdCounter - 1}`,
    x: Math.random() * (svgWidth.value - 100) + 50,
    y: Math.random() * (svgHeight.value - 100) + 50,
    radius: 25,
    active: false,
    value: Math.floor(Math.random() * 100),
    valueType: 'number',
  }
  nodes[id] = node
}

function addComputedNode() {
  const id = `computed_${nodeIdCounter++}`
  const availableDataNodes = Object.values(nodes).filter(n => n.type === 'data')

  if (availableDataNodes.length === 0) {
    alert('请先添加一些数据节点')
    return
  }

  const node: GraphNode = {
    id,
    type: 'computed',
    label: `计算${nodeIdCounter - 1}`,
    x: Math.random() * (svgWidth.value - 100) + 50,
    y: Math.random() * (svgHeight.value - 100) + 50,
    radius: 30,
    active: false,
    computeFn: () => {
      // 简单的计算函数示例
      const deps = edges.filter(e => e.to === id).map(e => nodes[e.from])
      return deps.reduce((sum, dep) => sum + (Number(dep.value) || 0), 0)
    },
  }
  nodes[id] = node

  // 随机连接到一些数据节点
  const numConnections = Math.min(
    Math.floor(Math.random() * 3) + 1,
    availableDataNodes.length,
  )
  const selectedNodes = availableDataNodes
    .sort(() => Math.random() - 0.5)
    .slice(0, numConnections)

  selectedNodes.forEach(dataNode => {
    edges.push({
      from: dataNode.id,
      to: id,
      type: 'dependency',
      active: false,
    })
  })

  updateComputedValue(id)
}

function addEffectNode() {
  const id = `effect_${nodeIdCounter++}`
  const availableNodes = Object.values(nodes).filter(n => n.type !== 'effect')

  if (availableNodes.length === 0) {
    alert('请先添加一些数据节点或计算属性')
    return
  }

  const node: GraphNode = {
    id,
    type: 'effect',
    label: `副作用${nodeIdCounter - 1}`,
    x: Math.random() * (svgWidth.value - 100) + 50,
    y: Math.random() * (svgHeight.value - 100) + 50,
    radius: 20,
    active: false,
  }
  nodes[id] = node

  // 随机连接到一些节点
  const numConnections = Math.min(
    Math.floor(Math.random() * 2) + 1,
    availableNodes.length,
  )
  const selectedNodes = availableNodes
    .sort(() => Math.random() - 0.5)
    .slice(0, numConnections)

  selectedNodes.forEach(sourceNode => {
    edges.push({
      from: sourceNode.id,
      to: id,
      type: 'subscription',
      active: false,
    })
  })
}

function removeNode(nodeId: string) {
  // 移除相关的边
  for (let i = edges.length - 1; i >= 0; i--) {
    if (edges[i].from === nodeId || edges[i].to === nodeId) {
      edges.splice(i, 1)
    }
  }

  // 移除节点
  delete nodes[nodeId]

  if (selectedNode.value?.id === nodeId) {
    selectedNode.value = null
  }
}

function clearGraph() {
  Object.keys(nodes).forEach(nodeId => delete nodes[nodeId])
  edges.splice(0, edges.length)
  selectedNode.value = null
}

function autoLayout() {
  const nodeArray = Object.values(nodes)
  const centerX = svgWidth.value / 2
  const centerY = svgHeight.value / 2
  const radius = Math.min(svgWidth.value, svgHeight.value) / 3

  nodeArray.forEach((node, index) => {
    const angle = (index / nodeArray.length) * 2 * Math.PI
    node.x = centerX + Math.cos(angle) * radius
    node.y = centerY + Math.sin(angle) * radius
  })
}

// 值更新
function updateNodeValue(nodeId: string, newValue: any) {
  const node = nodes[nodeId]
  if (!node) return

  if (node.valueType === 'number') {
    node.value = Number(newValue) || 0
  } else {
    node.value = newValue
  }

  // 触发依赖更新
  triggerNode(nodeId)
}

function toggleNodeValue(nodeId: string) {
  const node = nodes[nodeId]
  if (node && node.valueType === 'boolean') {
    node.value = !node.value
    triggerNode(nodeId)
  }
}

function triggerNode(nodeId: string) {
  const node = nodes[nodeId]
  if (!node) return

  // 激活当前节点
  node.active = true

  // 更新所有依赖此节点的计算属性
  const dependentEdges = edges.filter(e => e.from === nodeId)
  dependentEdges.forEach(edge => {
    edge.active = true
    const dependentNode = nodes[edge.to]
    if (dependentNode && dependentNode.type === 'computed') {
      updateComputedValue(dependentNode.id)
      dependentNode.active = true
    }
  })

  // 递归触发依赖链
  setTimeout(() => {
    dependentEdges.forEach(edge => {
      if (nodes[edge.to]?.type === 'computed') {
        triggerNode(edge.to)
      }
    })
  }, 300)

  // 重置激活状态
  setTimeout(() => {
    node.active = false
    dependentEdges.forEach(edge => {
      edge.active = false
      if (nodes[edge.to]) {
        nodes[edge.to].active = false
      }
    })
  }, 1000)
}

function updateComputedValue(nodeId: string) {
  const node = nodes[nodeId]
  if (!node || node.type !== 'computed') return

  if (node.computeFn) {
    node.value = node.computeFn()
  }
}

// 交互处理
function selectNode(node: GraphNode) {
  selectedNode.value = node
}

function startDrag(node: GraphNode, event: MouseEvent) {
  isDragging.value = true
  dragNode.value = node
  dragOffset.x = event.clientX - node.x
  dragOffset.y = event.clientY - node.y
  event.preventDefault()
}

function onSvgMouseDown(event: MouseEvent) {
  if (event.target === event.currentTarget) {
    selectedNode.value = null
  }
}

function onSvgMouseMove(event: MouseEvent) {
  if (isDragging.value && dragNode.value) {
    dragNode.value.x = event.clientX - dragOffset.x
    dragNode.value.y = event.clientY - dragOffset.y

    // 限制在SVG范围内
    dragNode.value.x = Math.max(
      dragNode.value.radius,
      Math.min(svgWidth.value - dragNode.value.radius, dragNode.value.x),
    )
    dragNode.value.y = Math.max(
      dragNode.value.radius,
      Math.min(svgHeight.value - dragNode.value.radius, dragNode.value.y),
    )
  }
}

function onSvgMouseUp() {
  isDragging.value = false
  dragNode.value = null
}

// 工具函数
function getNodeIcon(type: string): string {
  switch (type) {
    case 'data':
      return '📊'
    case 'computed':
      return '🧮'
    case 'effect':
      return '⚡'
    default:
      return '◯'
  }
}

function getNodeTypeName(type: string): string {
  switch (type) {
    case 'data':
      return '响应式数据'
    case 'computed':
      return '计算属性'
    case 'effect':
      return '副作用'
    default:
      return '未知'
  }
}

function formatValue(value: any): string {
  if (typeof value === 'number') {
    return value.toFixed(2)
  }
  return String(value)
}

function getDependenciesCount(nodeId: string): number {
  return edges.filter(e => e.to === nodeId).length
}

function getSubscribersCount(nodeId: string): number {
  return edges.filter(e => e.from === nodeId).length
}

function getActivationPath(nodeId: string): string[] {
  const path = new Set<string>()
  const visited = new Set<string>()

  function traverse(id: string) {
    if (visited.has(id)) return
    visited.add(id)
    path.add(id)

    // 查找依赖
    edges.filter(e => e.to === id).forEach(e => traverse(e.from))
  }

  traverse(nodeId)
  return Array.from(path)
}

// 初始化
onMounted(() => {
  // 创建一些示例节点
  setTimeout(() => {
    addDataNode()
    addDataNode()
    addComputedNode()
    addEffectNode()
    autoLayout()
  }, 500)
})
</script>

<style scoped>
.dependency-graph {
  padding: 1rem;
}

.description {
  color: #666;
  margin-bottom: 2rem;
  font-size: 1.1rem;
  line-height: 1.6;
}

.graph-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding: 1rem;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.control-group {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.add-btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  color: white;
  transition: all 0.3s ease;
}

.data-btn {
  background: #42b883;
}

.data-btn:hover {
  background: #369870;
}

.computed-btn {
  background: #f39c12;
}

.computed-btn:hover {
  background: #e67e22;
}

.effect-btn {
  background: #e74c3c;
}

.effect-btn:hover {
  background: #c0392b;
}

.clear-btn {
  background: #6c757d;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
}

.layout-btn {
  background: #17a2b8;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
}

.animation-control {
  font-size: 0.9rem;
  color: #666;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.graph-container {
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  margin-bottom: 2rem;
  overflow: hidden;
}

.graph-container svg {
  display: block;
  cursor: grab;
}

.graph-container svg:active {
  cursor: grabbing;
}

.dependency-line {
  stroke: #666;
  stroke-opacity: 0.6;
  marker-end: url(#arrowhead);
  transition: all 0.3s ease;
}

.dependency-line.dependency {
  stroke: #42b883;
}

.dependency-line.subscription {
  stroke: #e74c3c;
  stroke-dasharray: 5, 5;
}

.node {
  cursor: pointer;
  transition: all 0.3s ease;
}

.node:hover {
  transform: scale(1.1);
}

.node.active {
  animation: pulse 1s infinite;
}

.node-bg.data {
  fill: #42b883;
  stroke: #369870;
  stroke-width: 2;
}

.node-bg.computed {
  fill: #f39c12;
  stroke: #e67e22;
  stroke-width: 2;
}

.node-bg.effect {
  fill: #e74c3c;
  stroke: #c0392b;
  stroke-width: 2;
}

.node.active .node-bg {
  fill: #fff;
  stroke-width: 3;
}

.node-icon {
  font-size: 14px;
  fill: white;
  pointer-events: none;
}

.node.active .node-icon {
  fill: #333;
}

.node-label {
  font-size: 10px;
  fill: #333;
  font-weight: bold;
  pointer-events: none;
}

.node-value {
  font-size: 8px;
  fill: #666;
  pointer-events: none;
}

.path-highlight {
  fill: none;
  stroke: #ffd700;
  stroke-width: 3;
  stroke-opacity: 0.7;
}

.info-panel {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  margin-bottom: 2rem;
}

.info-panel h3 {
  margin-bottom: 1rem;
  color: #333;
  font-size: 1.2rem;
}

.node-info {
  margin-bottom: 1rem;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
  border-bottom: 1px solid #f0f0f0;
}

.info-label {
  font-weight: 500;
  color: #555;
}

.info-value {
  font-family: 'Monaco', 'Consolas', monospace;
  background: #f8f9fa;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  border: 1px solid #e0e0e0;
}

.node-actions {
  display: flex;
  gap: 1rem;
}

.trigger-btn {
  background: #28a745;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
}

.remove-btn {
  background: #dc3545;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
}

.legend {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  margin-bottom: 2rem;
}

.legend h3 {
  margin-bottom: 1rem;
  color: #333;
  font-size: 1.2rem;
}

.legend-items {
  display: flex;
  gap: 2rem;
  flex-wrap: wrap;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.legend-node {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid;
}

.legend-node.data {
  background: #42b883;
  border-color: #369870;
}

.legend-node.computed {
  background: #f39c12;
  border-color: #e67e22;
}

.legend-node.effect {
  background: #e74c3c;
  border-color: #c0392b;
}

.legend-line {
  width: 30px;
  height: 2px;
  background: #666;
  position: relative;
}

.legend-line::after {
  content: '';
  position: absolute;
  right: -5px;
  top: -3px;
  width: 0;
  height: 0;
  border-left: 8px solid #666;
  border-top: 4px solid transparent;
  border-bottom: 4px solid transparent;
}

.data-operations {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.data-operations h3 {
  margin-bottom: 1rem;
  color: #333;
  font-size: 1.2rem;
}

.operations-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}

.operation-item {
  background: #f8f9fa;
  padding: 1rem;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
}

.operation-item label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #555;
}

.value-controls {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.value-input {
  flex: 1;
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
  background: #28a745;
  color: white;
  border-color: #28a745;
}

@keyframes pulse {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.2);
  }
  100% {
    transform: scale(1);
  }
}

@media (max-width: 1024px) {
  .graph-controls {
    flex-direction: column;
    gap: 1rem;
  }

  .control-group {
    flex-wrap: wrap;
  }

  .operations-grid {
    grid-template-columns: 1fr;
  }

  .legend-items {
    justify-content: center;
  }
}
</style>
