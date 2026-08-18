import type { TagDefinition, TagQuality, TagSnapshot, TagValue } from '../../shared/tag'

export type TagCacheListener = (values: TagValue[]) => void

export class TagCache {
  private readonly definitions: TagDefinition[]
  private readonly values = new Map<string, TagValue>()
  private readonly listeners = new Set<TagCacheListener>()

  constructor(definitions: readonly TagDefinition[], now: () => string = () => new Date().toISOString()) {
    this.definitions = [...definitions].sort((left, right) => left.displayOrder - right.displayOrder)

    for (const definition of this.definitions) {
      this.values.set(definition.id, {
        tagId: definition.id,
        value: null,
        quality: 'Uncertain',
        timestamp: now()
      })
    }
  }

  getDefinitions(): TagDefinition[] {
    return this.definitions.map((definition) => ({ ...definition }))
  }

  getSnapshot(deviceId: string): TagSnapshot {
    return {
      deviceId,
      definitions: this.getDefinitions().filter((definition) => definition.deviceId === deviceId),
      values: this.getValuesByDevice(deviceId),
      emittedAt: new Date().toISOString()
    }
  }

  getValue(tagId: string): TagValue | undefined {
    const value = this.values.get(tagId)
    return value ? { ...value } : undefined
  }

  getValuesByDevice(deviceId: string): TagValue[] {
    return this.definitions
      .filter((definition) => definition.deviceId === deviceId)
      .map((definition) => this.values.get(definition.id))
      .filter((value): value is TagValue => value !== undefined)
      .map((value) => ({ ...value }))
  }

  setValues(values: readonly TagValue[]): TagValue[] {
    const changed: TagValue[] = []

    for (const value of values) {
      const previous = this.values.get(value.tagId)
      const next = { ...value }
      this.values.set(value.tagId, next)

      if (!previous || previous.value !== next.value || previous.quality !== next.quality) {
        changed.push({ ...next })
      }
    }

    if (changed.length > 0) {
      this.emit(changed)
    }

    return changed
  }

  markDeviceQuality(deviceId: string, quality: TagQuality, timestamp = new Date().toISOString()): TagValue[] {
    const values = this.definitions
      .filter((definition) => definition.deviceId === deviceId)
      .map((definition) => {
        const previous = this.values.get(definition.id)
        return {
          tagId: definition.id,
          value: previous?.value ?? null,
          quality,
          timestamp
        } satisfies TagValue
      })

    this.setValues(values)
    return values
  }

  markStaleTags(
    deviceId: string,
    nowMs = Date.now(),
    timestamp = new Date(nowMs).toISOString()
  ): TagValue[] {
    const staleValues = this.definitions
      .filter((definition) => definition.deviceId === deviceId)
      .flatMap((definition) => {
        const previous = this.values.get(definition.id)
        if (!previous || previous.quality !== 'Good') {
          return []
        }

        const previousTime = Date.parse(previous.timestamp)
        const staleTimeoutMs = Math.max(definition.scanRate * 3, 3000)
        if (!Number.isFinite(previousTime) || nowMs - previousTime < staleTimeoutMs) {
          return []
        }

        return [{
          tagId: definition.id,
          value: previous.value,
          quality: 'Bad',
          timestamp
        } satisfies TagValue]
      })

    this.setValues(staleValues)
    return staleValues
  }

  subscribe(listener: TagCacheListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  dispose(): void {
    this.listeners.clear()
  }

  private emit(values: TagValue[]): void {
    this.listeners.forEach((listener) => {
      listener(values.map((value) => ({ ...value })))
    })
  }
}
