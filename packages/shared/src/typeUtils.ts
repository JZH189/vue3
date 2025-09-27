export type Prettify<T> = { [K in keyof T]: T[K] } & {}

export type UnionToIntersection<U> = (
  U extends any ? (k: U) => void : never
) extends (k: infer I) => void
  ? I
  : never

// make keys required but keep undefined values
export type LooseRequired<T> = { [P in keyof (T & Required<T>)]: T[P] }

/**
 * 检测类型 T 是否为 any 类型的工具类型
 *
 * 工作原理：
 * 1. 使用交集类型 1 & T 来检测 any
 * 2. 当 T 为 any 时，1 & any = any，此时 0 extends any 为 true
 * 3. 当 T 为其他类型时，1 & T = never（数字与非数字的交集），此时 0 extends never 为 false
 *
 * @template T - 要检测的类型
 * @template Y - 如果 T 是 any 类型时返回的类型
 * @template N - 如果 T 不是 any 类型时返回的类型
 *
 * 应用场景：
 * - 在 Vue 3 的 ref 函数中处理 any 类型的特殊情况
 * - 防止 any 类型破坏类型安全
 * - 提供更精确的类型推导
 *
 * 技术原理：
 * - 利用 TypeScript 中 any 类型与任何类型的交集都是 any 的特性
 * - 利用 0 可以赋值给 any 但不能赋值给 never 的特性
 *
 * 参考：https://stackoverflow.com/questions/49927523/disallow-call-with-any/49928360#49928360
 */
export type IfAny<T, Y, N> = 0 extends 1 & T ? Y : N

export type IsKeyValues<T, K = string> = IfAny<
  T,
  false,
  T extends object ? (keyof T extends K ? true : false) : false
>

/**
 * Utility for extracting the parameters from a function overload (for typed emits)
 * https://github.com/microsoft/TypeScript/issues/32164#issuecomment-1146737709
 */
export type OverloadParameters<T extends (...args: any[]) => any> = Parameters<
  OverloadUnion<T>
>

type OverloadProps<TOverload> = Pick<TOverload, keyof TOverload>

type OverloadUnionRecursive<
  TOverload,
  TPartialOverload = unknown,
> = TOverload extends (...args: infer TArgs) => infer TReturn
  ? TPartialOverload extends TOverload
    ? never
    :
        | OverloadUnionRecursive<
            TPartialOverload & TOverload,
            TPartialOverload &
              ((...args: TArgs) => TReturn) &
              OverloadProps<TOverload>
          >
        | ((...args: TArgs) => TReturn)
  : never

type OverloadUnion<TOverload extends (...args: any[]) => any> = Exclude<
  OverloadUnionRecursive<(() => never) & TOverload>,
  TOverload extends () => never ? never : () => never
>
