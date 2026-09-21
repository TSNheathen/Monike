// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

const excluded = new Set(['node_modules', '.git', '.tmp', 'dist', 'tools', 'pb_data', 'data', 'test-results', 'playwright-report'])

function sources(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (excluded.has(entry.name)) return []
    const filename = path.join(directory, entry.name)
    return entry.isDirectory() ? sources(filename) : /\.jsx?$/.test(entry.name) ? [filename] : []
  })
}

it('každý vlastní JS/JSX soubor má nejvýše 700 řádků', () => {
  const oversized = sources(path.resolve('..')).flatMap((filename) => {
    const source = readFileSync(filename, 'utf8')
    const lines = source.split('\n').length - Number(source.endsWith('\n'))
    return lines > 700 ? [`${path.relative(process.cwd(), filename)}: ${lines}`] : []
  })
  expect(oversized).toEqual([])
})
