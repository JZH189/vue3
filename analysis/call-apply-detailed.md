# 详解 call 和 apply（带例子、原理与 polyfill）

## 1. 本质与语法（最重要）

- `func.call(thisArg, arg1, arg2, ...)`：以 `thisArg` 作为函数内部的 `this`，并按顺序传入参数。
- `func.apply(thisArg, argsArray)`：以 `thisArg` 作为 `this`，参数放在数组（或类数组）里。

示例：

```js
function greet(greeting, punctuation) {
  return greeting + ', ' + this.name + punctuation
}
const obj = { name: 'Alice' }

greet.call(obj, 'Hi', '!') // "Hi, Alice!"
greet.apply(obj, ['Hello', '...']) // "Hello, Alice..."
```

## 2. 为什么要用它们？

- 改变函数执行时的 `this` 指向（方法借用 / 函数重用）。
- 将类数组（如 `arguments`、`NodeList`）当作数组方法的参数。
- 把数组作为一组参数传入一个接受多个独立参数的函数。
- 在构造函数里用来复用另一个构造器的初始化逻辑：`Parent.call(this, ...)`。

## 3. this 的绑定规则与严格模式

- 如果 `thisArg` 是 `null` 或 `undefined`：
  - 非严格模式：`this` 会指向全局对象。
  - 严格模式：`this` 保持为 `null` / `undefined`。
- 如果 `thisArg` 是原始值，会被装箱成对象。
- 箭头函数没有自己的 `this`，`call`/`apply` 无法改变。

## 4. call vs apply vs bind

- call：参数一个个传。
- apply：参数放数组。
- bind：返回一个新函数，`this` 被永久绑定。

## 5. 常见实战例子

1. 借用数组方法（类数组转数组）

```js
Array.prototype.slice.call(arguments)
```

2. Math.max 找数组中最大值

```js
Math.max.apply(null, [3, 5, 1])
```

3. 构造函数复用

```js
function Parent(name) {
  this.name = name
}
function Child(name, age) {
  Parent.call(this, name)
  this.age = age
}
```

## 6. 注意事项

- 避免在 setter 内递归调用。
- apply 在参数非常多时可能触发引擎限制。
- call/apply 的第一个参数必须是函数。

## 7. polyfill

```js
Function.prototype.myCall = function (thisArg, ...args) {
  thisArg =
    thisArg === null || thisArg === undefined ? globalThis : Object(thisArg)
  const fnSym = Symbol()
  thisArg[fnSym] = this
  const result = thisArg[fnSym](...args)
  delete thisArg[fnSym]
  return result
}
```

## 8. 现代替代

- Reflect.apply(fn, thisArg, argsArray)
- 扩展运算符 `fn(...args)`
- Array.from / `[...arguments]`

## 9. 小结

- call: 单个参数逐一传。
- apply: 参数数组。
- 用于显式设置 this，方法借用，数组处理。
- 箭头函数 this 不受影响。
