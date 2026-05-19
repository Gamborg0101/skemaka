import type { Dispatch, SetStateAction } from "react"

/**
 * Provides patch, remove, and addOptimistic helpers for a flat list of items.
 * Each operation applies the change immediately and rolls back on failure.
 *
 * @param items   — current list (from useState)
 * @param setItems — corresponding setter
 *
 * Fetcher contract:
 *   patch / addOptimistic — return T to replace with server item, null to keep optimistic
 *   remove — throw on failure, return void on success
 */
export function useOptimisticList<T extends { id: string }>(
  items: T[],
  setItems: Dispatch<SetStateAction<T[]>>
) {
  async function patch(id: string, partial: Partial<T>, fetcher: () => Promise<T | null>) {
    const original = items.find((item) => item.id === id)
    setItems((curr) => curr.map((item) => item.id === id ? { ...item, ...partial } : item))
    try {
      const serverItem = await fetcher()
      if (serverItem !== null) {
        setItems((curr) => curr.map((item) => item.id === id ? serverItem : item))
      }
    } catch {
      if (original) setItems((curr) => curr.map((item) => item.id === id ? original : item))
    }
  }

  async function remove(id: string, fetcher: () => Promise<void>) {
    const removed = items.find((item) => item.id === id)
    setItems((curr) => curr.filter((item) => item.id !== id))
    try {
      await fetcher()
    } catch {
      if (removed) setItems((curr) => [...curr, removed])
    }
  }

  async function addOptimistic(tempItem: T, fetcher: () => Promise<T>) {
    setItems((curr) => [...curr, tempItem])
    try {
      const serverItem = await fetcher()
      setItems((curr) => curr.map((item) => item.id === tempItem.id ? serverItem : item))
    } catch {
      setItems((curr) => curr.filter((item) => item.id !== tempItem.id))
    }
  }

  return { patch, remove, addOptimistic }
}
