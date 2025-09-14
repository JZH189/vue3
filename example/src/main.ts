import { computed, createApp, ref, watch } from 'vue'
import './style.css'

// 为了方便调试，在这里设置一个断点
console.info('Vue 3 应用启动中...')

// 类型定义
interface Todo {
  id: number
  text: string
  completed: boolean
  createdAt: Date
}

// 创建 Vue 应用实例
const app = createApp({
  setup() {
    // 响应式数据
    const newTodo = ref('')
    const todos = ref<Todo[]>([])
    const currentFilter = ref<'all' | 'active' | 'completed'>('all')

    // 筛选器配置
    const filters = [
      { key: 'all' as const, label: '全部' },
      { key: 'active' as const, label: '进行中' },
      { key: 'completed' as const, label: '已完成' },
    ]

    // 计算属性 - 这里是调试响应式系统的好地方
    const filteredTodos = computed(() => {
      console.info('计算属性 filteredTodos 被重新计算')

      switch (currentFilter.value) {
        case 'active':
          return todos.value.filter(todo => !todo.completed)
        case 'completed':
          return todos.value.filter(todo => todo.completed)
        default:
          return todos.value
      }
    })

    const completedCount = computed(() => {
      console.info('计算属性 completedCount 被重新计算')
      return todos.value.filter(todo => todo.completed).length
    })

    // 方法
    const addTodo = () => {
      const text = newTodo.value.trim()
      if (!text) return

      console.info('添加新的待办事项:', text)

      const todo: Todo = {
        id: Date.now(),
        text,
        completed: false,
        createdAt: new Date(),
      }

      todos.value.push(todo)
      newTodo.value = ''
    }

    const deleteTodo = (id: number) => {
      console.info('删除待办事项:', id)
      const index = todos.value.findIndex(todo => todo.id === id)
      if (index > -1) {
        todos.value.splice(index, 1)
      }
    }

    const toggleTodo = (id: number) => {
      const todo = todos.value.find(t => t.id === id)
      if (todo) {
        todo.completed = !todo.completed
      }
    }

    // 监听器 - 调试响应式系统的另一个好地方
    watch(
      todos,
      newTodos => {
        console.info('todos 数组发生变化:', newTodos)
        // 这里可以设置断点来观察响应式系统如何工作
        localStorage.setItem('vue3-todos', JSON.stringify(newTodos))
      },
      { deep: true },
    )

    watch(currentFilter, newFilter => {
      console.info('筛选器变化:', newFilter)
    })

    // 初始化数据
    const initTodos = () => {
      try {
        const saved = localStorage.getItem('vue3-todos')
        if (saved) {
          todos.value = JSON.parse(saved)
          console.info('从本地存储加载待办事项:', todos.value)
        }
      } catch (error) {
        console.error('加载本地数据失败:', error)
      }

      // 如果没有数据，添加一些示例数据
      if (todos.value.length === 0) {
        todos.value = [
          {
            id: 1,
            text: '学习 Vue 3 Composition API',
            completed: false,
            createdAt: new Date(),
          },
          {
            id: 2,
            text: '调试 Vue 3 响应式系统源码',
            completed: false,
            createdAt: new Date(),
          },
          {
            id: 3,
            text: '理解虚拟 DOM 工作原理',
            completed: true,
            createdAt: new Date(),
          },
        ]
      }
    }

    // 组件挂载时初始化
    initTodos()

    return {
      newTodo,
      todos,
      currentFilter,
      filters,
      filteredTodos,
      completedCount,
      addTodo,
      deleteTodo,
      toggleTodo,
    }
  },

  template: `
    <div class="todo-container">
      <!-- 头部 -->
      <div class="todo-header">
        <h1>Vue 3 Todo List</h1>
        <p>源码调试示例 - 体验响应式系统</p>
      </div>

      <!-- 输入区域 -->
      <div class="todo-input-section">
        <div class="todo-input-group">
          <input
            v-model="newTodo"
            @keyup.enter="addTodo"
            class="todo-input"
            placeholder="请输入待办事项..."
            maxlength="100"
          />
          <button
            @click="addTodo"
            :disabled="!newTodo.trim()"
            class="todo-add-btn"
          >
            添加
          </button>
        </div>
      </div>

      <!-- 统计信息 -->
      <div class="todo-stats">
        <span>总计: {{ todos.length }} 项</span>
        <div class="filters">
          <button
            v-for="filter in filters"
            :key="filter.key"
            :class="['filter-btn', { active: currentFilter === filter.key }]"
            @click="currentFilter = filter.key"
          >
            {{ filter.label }}
          </button>
        </div>
        <span>已完成: {{ completedCount }} 项</span>
      </div>

      <!-- 待办列表 -->
      <div class="todo-list">
        <div
          v-for="todo in filteredTodos"
          :key="todo.id"
          :class="['todo-item', { completed: todo.completed }]"
        >
          <input
            type="checkbox"
            :checked="todo.completed"
            @change="toggleTodo(todo.id)"
            class="todo-checkbox"
          />
          <span :class="['todo-text', { completed: todo.completed }]">
            {{ todo.text }}
          </span>
          <button
            @click="deleteTodo(todo.id)"
            class="todo-delete-btn"
          >
            删除
          </button>
        </div>

        <!-- 空状态 -->
        <div v-if="filteredTodos.length === 0" class="empty-state">
          <div class="empty-state-icon">📝</div>
          <p v-if="todos.length === 0">暂无待办事项，创建第一个吧！</p>
          <p v-else>当前筛选条件下没有待办事项</p>
        </div>
      </div>
    </div>
  `,
})

// 挂载到 DOM
app.mount('#app')

console.info('Vue 3 应用已启动')
console.info(
  '当前 Vue 版本:',
  import.meta.env.DEV ? '开发版本(源码)' : '生产版本',
)
