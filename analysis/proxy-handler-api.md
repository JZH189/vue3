# Proxy 与 Handler API 语法手册

`Proxy` 是 ES6 引入的一种元编程能力，用于拦截和自定义对象的底层操作。  
基本语法：

```js
const proxy = new Proxy(target, handler)
```

- **target**: 目标对象（必须是对象，可以是数组、函数、对象等）。
- **handler**: 一个对象，定义拦截方法（trap）。

---

## Proxy 基本使用

```js
let proxy = new Proxy(target, {
  // trap 函数
})
```

---

## Handler API 列表（所有 trap）

### 1. `handler.get(target, prop, receiver)`

拦截对象属性的读取。

```js
const proxy = new Proxy(obj, {
  get(target, prop, receiver) {
    console.log(`读取属性: ${prop}`)
    return Reflect.get(target, prop, receiver)
  },
})
```

---

### 2. `handler.set(target, prop, value, receiver)`

拦截对象属性的设置。

```js
const proxy = new Proxy(obj, {
  set(target, prop, value, receiver) {
    console.log(`设置属性: ${prop} = ${value}`)
    return Reflect.set(target, prop, value, receiver)
  },
})
```

---

### 3. `handler.has(target, prop)`

拦截 `in` 操作符。

```js
const proxy = new Proxy(obj, {
  has(target, prop) {
    return prop.startsWith('_') ? false : prop in target
  },
})
```

---

### 4. `handler.deleteProperty(target, prop)`

拦截 `delete` 操作。

```js
const proxy = new Proxy(obj, {
  deleteProperty(target, prop) {
    console.log(`删除属性: ${prop}`)
    return Reflect.deleteProperty(target, prop)
  },
})
```

---

### 5. `handler.apply(target, thisArg, args)`

拦截函数调用。

```js
function sum(a, b) {
  return a + b
}

const proxy = new Proxy(sum, {
  apply(target, thisArg, args) {
    console.log(`调用函数，参数: ${args}`)
    return Reflect.apply(target, thisArg, args)
  },
})
```

---

### 6. `handler.construct(target, args, newTarget)`

拦截 `new` 操作。

```js
class Person {
  constructor(name) {
    this.name = name
  }
}

const proxy = new Proxy(Person, {
  construct(target, args, newTarget) {
    console.log(`创建实例，参数: ${args}`)
    return Reflect.construct(target, args, newTarget)
  },
})
```

---

### 7. `handler.getPrototypeOf(target)`

拦截 `Object.getPrototypeOf`。

```js
const proxy = new Proxy(obj, {
  getPrototypeOf(target) {
    return null // 隐藏原型
  },
})
```

---

### 8. `handler.setPrototypeOf(target, proto)`

拦截 `Object.setPrototypeOf`。

```js
const proxy = new Proxy(obj, {
  setPrototypeOf(target, proto) {
    console.log('禁止修改原型')
    return false
  },
})
```

---

### 9. `handler.isExtensible(target)`

拦截 `Object.isExtensible`。

```js
const proxy = new Proxy(obj, {
  isExtensible(target) {
    return false
  },
})
```

---

### 10. `handler.preventExtensions(target)`

拦截 `Object.preventExtensions`。

```js
const proxy = new Proxy(obj, {
  preventExtensions(target) {
    console.log('禁止扩展对象')
    return Reflect.preventExtensions(target)
  },
})
```

---

### 11. `handler.getOwnPropertyDescriptor(target, prop)`

拦截 `Object.getOwnPropertyDescriptor`。

```js
const proxy = new Proxy(obj, {
  getOwnPropertyDescriptor(target, prop) {
    console.log(`获取属性描述符: ${prop}`)
    return Reflect.getOwnPropertyDescriptor(target, prop)
  },
})
```

---

### 12. `handler.defineProperty(target, prop, descriptor)`

拦截 `Object.defineProperty`。

```js
const proxy = new Proxy(obj, {
  defineProperty(target, prop, descriptor) {
    console.log(`定义属性: ${prop}`)
    return Reflect.defineProperty(target, prop, descriptor)
  },
})
```

---

### 13. `handler.ownKeys(target)`

拦截 `Object.keys()`、`for...in`、`Object.getOwnPropertyNames`、`Object.getOwnPropertySymbols`。

```js
const proxy = new Proxy(obj, {
  ownKeys(target) {
    return Reflect.ownKeys(target).filter(k => !k.startsWith('_'))
  },
})
```

---

## Reflect 对象

通常在 `Proxy` 中使用 `Reflect` 保持默认行为。

示例：

```js
Reflect.get(target, prop, receiver)
Reflect.set(target, prop, value, receiver)
Reflect.has(target, prop)
Reflect.deleteProperty(target, prop)
Reflect.apply(target, thisArg, args)
Reflect.construct(target, args, newTarget)
Reflect.getPrototypeOf(target)
Reflect.setPrototypeOf(target, proto)
Reflect.isExtensible(target)
Reflect.preventExtensions(target)
Reflect.getOwnPropertyDescriptor(target, prop)
Reflect.defineProperty(target, prop, descriptor)
Reflect.ownKeys(target)
```

---

## 总结

`Proxy` 提供了 **13 个 trap** 来拦截对象/函数的底层操作，搭配 `Reflect` 可以安全地代理对象。
