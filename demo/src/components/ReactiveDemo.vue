<template>
  <div class="reactive-demo">
    <h2>🔄 Reactive 与 Ref 对比演示</h2>
    <p class="description">
      对比 Vue 3 中 reactive 和 ref 两种响应式 API 的使用方式和区别
    </p>

    <div class="demo-intro">
      <div class="intro-card">
        <h3>reative vs ref</h3>
        <p>
          <strong>reactive()</strong>
          用于创建响应式对象，它返回一个原始对象的代理。
          <strong>ref()</strong> 用于创建响应式的基本类型值，它返回一个包含
          value 属性的对象。
        </p>
      </div>
    </div>

    <div class="demo-comparison">
      <!-- Reactive 示例 -->
      <div class="comparison-panel">
        <h3>🌀 Reactive 示例</h3>
        <div class="code-example">
          <pre><code>import { reactive } from 'vue'

const state = reactive({
  name: 'Vue开发者',
  age: 25,
  skills: ['JavaScript', 'Vue']
})

// 直接访问属性
console.log(state.name)
state.age = 26</code></pre>
        </div>
        <div class="explanation">
          <ul>
            <li>用于对象类型（Object, Array）</li>
            <li>直接访问属性，无需 .value</li>
            <li>解构会失去响应性</li>
            <li>使用 Proxy 实现</li>
          </ul>
        </div>
      </div>

      <!-- Ref 示例 -->
      <div class="comparison-panel">
        <h3>🎯 Ref 示例</h3>
        <div class="code-example">
          <pre><code>import { ref } from 'vue'

const name = ref('Vue开发者')
const age = ref(25)
const skills = ref(['JavaScript', 'Vue'])

// 通过 .value 访问
console.log(name.value)
name.value = '新名字'</code></pre>
        </div>
        <div class="explanation">
          <ul>
            <li>用于基本类型和对象类型</li>
            <li>需要通过 .value 访问值</li>
            <li>解构不会失去响应性</li>
            <li>使用 getter/setter 实现</li>
          </ul>
        </div>
      </div>
    </div>

    <!-- 详细说明 -->
    <div class="detailed-explanation">
      <h3>📋 详细对比</h3>
      <table>
        <thead>
          <tr>
            <th>特性</th>
            <th>reactive</th>
            <th>ref</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>适用类型</td>
            <td>对象/数组</td>
            <td>所有类型</td>
          </tr>
          <tr>
            <td>访问方式</td>
            <td>直接属性访问</td>
            <td>通过 .value</td>
          </tr>
          <tr>
            <td>解构</td>
            <td>会失去响应性</td>
            <td>保持响应性</td>
          </tr>
          <tr>
            <td>实现原理</td>
            <td>ES6 Proxy</td>
            <td>getter/setter</td>
          </tr>
          <tr>
            <td>使用场景</td>
            <td>复杂数据结构</td>
            <td>简单值或需要解构的场景</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 最佳实践 -->
    <div class="best-practices">
      <h3>🏆 最佳实践</h3>
      <div class="practices-grid">
        <div class="practice-item">
          <h4>选择合适的 API</h4>
          <p>对于对象和数组使用 reactive，对于基本类型使用 ref</p>
        </div>
        <div class="practice-item">
          <h4>组合使用</h4>
          <p>在实际项目中，reactive 和 ref 经常组合使用</p>
        </div>
        <div class="practice-item">
          <h4>避免解构陷阱</h4>
          <p>reactive 对象解构会失去响应性，可以使用 toRefs 转换</p>
        </div>
        <div class="practice-item">
          <h4>统一访问</h4>
          <p>ref 也可以用于对象，保持访问方式的一致性</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// 此组件主要用于演示和对比，不需要实际的响应式数据
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
  text-align: center;
}

.demo-intro {
  margin-bottom: 2rem;
  text-align: center;
}

.intro-card {
  background: linear-gradient(135deg, #42b883 0%, #35495e 100%);
  color: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.intro-card h3 {
  font-size: 1.5rem;
  margin-bottom: 1rem;
}

.intro-card p {
  font-size: 1.1rem;
  line-height: 1.6;
}

.intro-card strong {
  font-weight: 600;
}

.demo-comparison {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  margin-bottom: 2rem;
}

.comparison-panel {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.comparison-panel h3 {
  margin-bottom: 1rem;
  color: #333;
  font-size: 1.3rem;
  text-align: center;
}

.code-example {
  background: #1a1a1a;
  color: #f0f0f0;
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1rem;
  font-family: 'Monaco', 'Consolas', monospace;
  font-size: 0.9rem;
  overflow-x: auto;
}

.code-example code {
  line-height: 1.4;
}

.explanation {
  background: #f8f9fa;
  padding: 1rem;
  border-radius: 8px;
}

.explanation ul {
  padding-left: 1.5rem;
}

.explanation li {
  margin-bottom: 0.5rem;
  line-height: 1.5;
}

.detailed-explanation {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  margin-bottom: 2rem;
}

.detailed-explanation h3 {
  text-align: center;
  margin-bottom: 1.5rem;
  color: #333;
  font-size: 1.4rem;
}

.detailed-explanation table {
  width: 100%;
  border-collapse: collapse;
}

.detailed-explanation th,
.detailed-explanation td {
  padding: 1rem;
  text-align: left;
  border-bottom: 1px solid #eee;
}

.detailed-explanation th {
  background: #f8f9fa;
  font-weight: 600;
  color: #333;
}

.detailed-explanation tr:last-child td {
  border-bottom: none;
}

.best-practices {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.best-practices h3 {
  text-align: center;
  margin-bottom: 1.5rem;
  color: #333;
  font-size: 1.4rem;
}

.practices-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
}

.practice-item {
  background: #f8f9fa;
  padding: 1.5rem;
  border-radius: 8px;
  border-left: 4px solid #42b883;
}

.practice-item h4 {
  margin-bottom: 0.5rem;
  color: #333;
}

.practice-item p {
  color: #666;
  line-height: 1.5;
}

@media (max-width: 1024px) {
  .demo-comparison {
    grid-template-columns: 1fr;
  }
}
</style>
