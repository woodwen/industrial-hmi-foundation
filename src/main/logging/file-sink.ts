import type { Logger } from './logger'

export interface FileLogSinkOptions {
  directory: string
}

export type FileLogSinkFactory = (options: FileLogSinkOptions) => Logger
