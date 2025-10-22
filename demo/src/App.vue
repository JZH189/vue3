<template>
  <div class="app">
    <header class="header">
      <h1>🔍 Vue 3 响应式系统可视化演示</h1>
      <p>通过交互式演示深入理解Vue 3响应式原理</p>
    </header>

    <main class="main">
      <div class="demo-tabs">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          :class="['tab-button', { active: activeTab === tab.key }]"
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
        </button>
      </div>

      <div class="demo-content">
        <component :is="currentComponent" />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import ReactiveOnlyDemo from './components/ReactiveOnlyDemo.vue'
import RefDemo from './components/RefDemo.vue'
import EffectDemo from './components/EffectDemo.vue'
import ComputedDemo from './components/ComputedDemo.vue'
import DependencyGraph from './components/DependencyGraph.vue'

const activeTab = ref('ref')

const tabs = [
  { key: 'ref', label: 'Ref演示', component: RefDemo },
  { key: 'reactive', label: 'Reactive演示', component: ReactiveOnlyDemo },
  { key: 'effect', label: '副作用系统', component: EffectDemo },
  { key: 'computed', label: '计算属性', component: ComputedDemo },
  { key: 'graph', label: '依赖关系图', component: DependencyGraph },
]

const currentComponent = computed(() => {
  return tabs.find(tab => tab.key === activeTab.value)?.component
})
</script>

<style scoped>
.app {
  padding: 0 50px;
  width: 100%;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 20px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  backdrop-filter: blur(10px);
}

.header {
  background: linear-gradient(135deg, #42b883 0%, #35495e 100%);
  color: white;
  padding: 2rem;
  text-align: center;
}

.header h1 {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
  font-weight: 600;
}

.header p {
  font-size: 1.1rem;
  opacity: 0.9;
}

.main {
  padding: 2rem;
}

.demo-tabs {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
  border-bottom: 2px solid #f0f0f0;
  padding-bottom: 1rem;
}

.tab-button {
  padding: 0.75rem 1.5rem;
  border: none;
  background: #f8f9fa;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 500;
  color: #666;
  transition: all 0.3s ease;
}

.tab-button:hover {
  background: #e9ecef;
  color: #333;
}

.tab-button.active {
  background: #42b883;
  color: white;
  box-shadow: 0 4px 12px rgba(66, 184, 131, 0.3);
}

.demo-content {
  min-height: 600px;
  padding: 1rem;
  background: #fafafa;
  border-radius: 12px;
  border: 1px solid #e0e0e0;
}
</style>
