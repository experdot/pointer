/**
 * Write Lock Module
 * Implements per-pageId mutex locks to prevent concurrent write race conditions
 */

type LockEntry = {
  promise: Promise<void>
  resolve: () => void
}

// Map of pageId -> pending lock entries
const locks = new Map<string, LockEntry[]>()

/**
 * Acquire a write lock for a specific pageId
 * Returns a release function that must be called when done
 */
export async function acquireWriteLock(pageId: string): Promise<() => void> {
  // Get or create lock queue for this pageId
  let queue = locks.get(pageId)
  if (!queue) {
    queue = []
    locks.set(pageId, queue)
  }

  // If there are pending locks, wait for the last one
  const lastLock = queue[queue.length - 1]
  if (lastLock) {
    await lastLock.promise
  }

  // Create our lock entry
  let releaseFn: () => void = () => {}
  const lockPromise = new Promise<void>((resolve) => {
    releaseFn = resolve
  })

  const entry: LockEntry = {
    promise: lockPromise,
    resolve: releaseFn
  }

  queue.push(entry)

  // Return release function
  return () => {
    // Remove this entry from queue
    const currentQueue = locks.get(pageId)
    if (currentQueue) {
      const index = currentQueue.indexOf(entry)
      if (index !== -1) {
        currentQueue.splice(index, 1)
      }
      // Clean up empty queues
      if (currentQueue.length === 0) {
        locks.delete(pageId)
      }
    }
    // Release the lock
    entry.resolve()
  }
}

/**
 * Execute a function with write lock protection
 * Automatically acquires and releases the lock
 */
export async function withWriteLock<T>(
  pageId: string,
  fn: () => Promise<T>
): Promise<T> {
  const release = await acquireWriteLock(pageId)
  try {
    return await fn()
  } finally {
    release()
  }
}

/**
 * Check if a pageId currently has an active lock
 */
export function hasLock(pageId: string): boolean {
  const queue = locks.get(pageId)
  return queue !== undefined && queue.length > 0
}

/**
 * Clear all locks (for testing/reset purposes)
 */
export function clearAllLocks(): void {
  // Resolve all pending locks
  for (const queue of locks.values()) {
    for (const entry of queue) {
      entry.resolve()
    }
  }
  locks.clear()
}
