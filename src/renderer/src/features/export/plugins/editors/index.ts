import { exportManager } from '../../ExportManager'
import { textEditorPlugin } from './textEditor'
import { csvEditorPlugin } from './csvEditor'

// Register all editor plugins
export function registerEditorPlugins(): void {
  exportManager.registerEditor(textEditorPlugin)
  exportManager.registerEditor(csvEditorPlugin)
}

// Re-export plugins
export { textEditorPlugin, csvEditorPlugin }
