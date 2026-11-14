import { RuntimeCore } from '../../src/main/runtime/RuntimeCore'
import fs from 'node:fs/promises'
import type { RuntimeCommandName, RuntimeCommandPayload } from '../../src/shared/contracts'

async function main(): Promise<void> {
  const [root, rawCommand, marker, count] = process.argv.slice(2)
  const runtime = new RuntimeCore({
    appDataPath: root,
    host: {
      getVersion: () => 'test',
      saveFile: async () => ({}),
      openTextFile: async () => null,
      pickDirectory: async () => null,
      pickImages: async () => [],
      openInFileManager: async () => undefined
    }
  })
  await runtime.init()
  // 在真实原子重命名后直接结束进程，不调用 dispose 或异常回滚。
  const rename = fs.rename
  let moves = 0
  fs.rename = async (from, to) => {
    await rename(from, to)
    if ((String(from).includes(marker) || String(to).includes(marker)) && ++moves === Number(count))
      process.exit(99)
  }
  const command = JSON.parse(rawCommand) as {
    name: RuntimeCommandName
    payload: RuntimeCommandPayload<RuntimeCommandName>
  }
  await runtime.command(command.name, command.payload)
  process.exit(0)
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
