import type { ReactNode } from 'react'

interface MarkdownDocumentProps {
  content: string
  emptyLabel: string
}

type MarkdownBlock =
  | { type: 'heading'; depth: number; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'code'; language: string; text: string }
  | { type: 'table'; rows: string[][] }

export function MarkdownDocument({ content, emptyLabel }: MarkdownDocumentProps): JSX.Element {
  const blocks = parseMarkdown(content)

  if (blocks.length === 0) {
    return <p className="empty-state">{emptyLabel}</p>
  }

  return (
    <div className="markdown-document">
      {blocks.map((block, index) => renderBlock(block, index))}
    </div>
  )
}

function renderBlock(block: MarkdownBlock, index: number): ReactNode {
  if (block.type === 'heading') {
    const Heading = `h${Math.min(Math.max(block.depth, 2), 4)}` as 'h2' | 'h3' | 'h4'
    return <Heading key={index}>{block.text}</Heading>
  }

  if (block.type === 'list') {
    return (
      <ul key={index}>
        {block.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    )
  }

  if (block.type === 'code') {
    return (
      <pre key={index}>
        <code>{block.text}</code>
      </pre>
    )
  }

  if (block.type === 'table') {
    const [header, separator, ...bodyRows] = block.rows
    const hasSeparator = separator?.every((cell) => /^:?-{3,}:?$/.test(cell.trim())) ?? false
    const rows = hasSeparator ? bodyRows : block.rows.slice(1)

    return (
      <div className="markdown-table-wrap" key={index}>
        <table>
          {header ? (
            <thead>
              <tr>
                {header.map((cell) => <th key={cell}>{cell}</th>)}
              </tr>
            </thead>
          ) : null}
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={`${index}-${rowIndex}`}>
                {row.map((cell, cellIndex) => <td key={`${cell}-${cellIndex}`}>{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return <p key={index}>{block.text}</p>
}

function parseMarkdown(content: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = []
  const lines = content.split(/\r?\n/)
  let paragraph: string[] = []
  let list: string[] = []
  let table: string[][] = []
  let code: { language: string; lines: string[] } | null = null

  const flushParagraph = (): void => {
    if (paragraph.length > 0) {
      blocks.push({
        type: 'paragraph',
        text: paragraph.join(' ')
      })
      paragraph = []
    }
  }

  const flushList = (): void => {
    if (list.length > 0) {
      blocks.push({
        type: 'list',
        items: list
      })
      list = []
    }
  }

  const flushTable = (): void => {
    if (table.length > 0) {
      blocks.push({
        type: 'table',
        rows: table
      })
      table = []
    }
  }

  const flushOpenBlocks = (): void => {
    flushParagraph()
    flushList()
    flushTable()
  }

  for (const line of lines) {
    const trimmed = line.trim()

    if (code) {
      if (trimmed.startsWith('```')) {
        blocks.push({
          type: 'code',
          language: code.language,
          text: code.lines.join('\n')
        })
        code = null
        continue
      }

      code.lines.push(line)
      continue
    }

    if (trimmed.startsWith('```')) {
      flushOpenBlocks()
      code = {
        language: trimmed.slice(3).trim(),
        lines: []
      }
      continue
    }

    if (trimmed.length === 0) {
      flushOpenBlocks()
      continue
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(trimmed)
    if (heading) {
      flushOpenBlocks()
      blocks.push({
        type: 'heading',
        depth: heading[1].length,
        text: heading[2]
      })
      continue
    }

    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      flushParagraph()
      flushList()
      table.push(trimmed.slice(1, -1).split('|').map((cell) => cell.trim()))
      continue
    }

    const listItem = /^[-*]\s+(.+)$/.exec(trimmed) ?? /^\d+\.\s+(.+)$/.exec(trimmed)
    if (listItem) {
      flushParagraph()
      flushTable()
      list.push(listItem[1])
      continue
    }

    flushList()
    flushTable()
    paragraph.push(trimmed)
  }

  if (code) {
    blocks.push({
      type: 'code',
      language: code.language,
      text: code.lines.join('\n')
    })
  }

  flushOpenBlocks()
  return blocks
}
