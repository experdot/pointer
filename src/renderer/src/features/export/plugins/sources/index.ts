import { exportManager } from '../../ExportManager'
import { messagesSourcePlugin } from './messagesSource'
import { textSnippetSourcePlugin } from './textSnippetSource'
import { tableBlockSourcePlugin } from './tableBlockSource'
import { codeBlockSourcePlugin } from './codeBlockSource'

// Register all source plugins
export function registerSourcePlugins(): void {
  exportManager.registerSource(messagesSourcePlugin)
  exportManager.registerSource(textSnippetSourcePlugin)
  exportManager.registerSource(tableBlockSourcePlugin)
  exportManager.registerSource(codeBlockSourcePlugin)
}

// Re-export plugins
export {
  messagesSourcePlugin,
  textSnippetSourcePlugin,
  tableBlockSourcePlugin,
  codeBlockSourcePlugin
}
