// Store 重置回调注册表 - 独立模块避免循环依赖

type ResetCallback = () => void | Promise<void>
type RehydrateCallback = () => void | Promise<void>

const storeResetCallbacks: ResetCallback[] = []
const storeRehydrateCallbacks: RehydrateCallback[] = []

// 注册 Store 重置回调（其他 Store 初始化时调用）
export function registerStoreReset(callback: ResetCallback, rehydrate?: RehydrateCallback): void {
  storeResetCallbacks.push(callback)
  if (rehydrate) {
    storeRehydrateCallbacks.push(rehydrate)
  }
}

// 重置所有已注册的 Store
export async function resetAllStores(): Promise<void> {
  for (const callback of storeResetCallbacks) {
    await callback()
  }
}

// 重新加载所有 Store 数据
export async function rehydrateAllStores(): Promise<void> {
  // 串行执行避免 IndexedDB 竞态条件
  for (const cb of storeRehydrateCallbacks) {
    await cb()
  }
}
