// Export feature module entry point

// Types
export * from './types'

// Manager
export { exportManager } from './ExportManager'
export type { SourcePlugin, FormatPlugin, PreviewerPlugin, EditorPlugin } from './ExportManager'

// Plugin registration
import { registerSourcePlugins } from './plugins/sources'
import { registerFormatPlugins } from './plugins/formats'
import { registerPreviewerPlugins } from './plugins/previewers'
import { registerEditorPlugins } from './plugins/editors'

/**
 * Initialize all export plugins
 * Call this once at app startup
 */
export function initializeExportPlugins(): void {
  registerSourcePlugins()
  registerFormatPlugins()
  registerPreviewerPlugins()
  registerEditorPlugins()
}

