/**
 * Store 层基础接口定义
 * 所有 Store 接口的共同基类
 */

/**
 * 可初始化的 Store
 */
export interface IInitializable {
  readonly initialized: boolean
  init(): Promise<void>
}

/**
 * 可重置的 Store
 */
export interface IResettable {
  reset(): Promise<void> | void
}

/**
 * 基础实体 Store 接口
 * 用于管理持久化的实体数据（如 Page, Folder, Account）
 *
 * @template T 实体类型
 * @template CreateDTO 创建时的数据传输对象类型（默认排除 id 和 createdAt）
 */
export interface IEntityStore<T, CreateDTO = Omit<T, 'id' | 'createdAt'>>
  extends IInitializable, IResettable {
  // ==================== 读取操作 ====================

  /**
   * 根据 ID 获取单个实体
   */
  getById(id: string): T | undefined

  /**
   * 获取所有实体
   */
  getAll(): T[]

  // ==================== 创建操作 ====================

  /**
   * 创建单个实体
   * @returns 创建后的完整实体（含生成的 id 和 createdAt）
   */
  create(data: CreateDTO): Promise<T>

  /**
   * 批量创建实体
   * @returns 创建后的完整实体数组
   */
  createMany(data: CreateDTO[]): Promise<T[]>

  // ==================== 更新操作 ====================

  /**
   * 更新单个实体
   */
  update(id: string, changes: Partial<T>): Promise<void>

  /**
   * 批量更新实体
   */
  updateMany(updates: Array<{ id: string; changes: Partial<T> }>): Promise<void>

  // ==================== 删除操作 ====================

  /**
   * 删除单个实体
   */
  delete(id: string): Promise<void>

  /**
   * 批量删除实体
   */
  deleteMany(ids: string[]): Promise<void>
}

/**
 * 缓存型 Store 接口
 * 用于管理按需加载的缓存数据（如 Messages）
 *
 * @template T 缓存的数据类型
 */
export interface ICachedStore<T> extends IResettable {
  /**
   * 加载数据到缓存
   * 如果已缓存则直接返回，否则从数据库加载
   */
  load(key: string): Promise<T>

  /**
   * 从缓存获取数据（不触发加载）
   */
  get(key: string): T | undefined

  /**
   * 检查是否已缓存
   */
  has(key: string): boolean

  /**
   * 清除指定缓存
   */
  evict(key: string): void

  /**
   * 清除所有缓存
   */
  evictAll(): void
}
