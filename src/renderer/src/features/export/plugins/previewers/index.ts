import { exportManager } from '../../ExportManager'
import { textPreviewerPlugin } from './textPreviewer'
import { htmlPreviewerPlugin } from './htmlPreviewer'
import { tablePreviewerPlugin } from './tablePreviewer'

// Register all previewer plugins
export function registerPreviewerPlugins(): void {
  exportManager.registerPreviewer(textPreviewerPlugin)
  exportManager.registerPreviewer(htmlPreviewerPlugin)
  exportManager.registerPreviewer(tablePreviewerPlugin)
}

// Re-export plugins
export { textPreviewerPlugin, htmlPreviewerPlugin, tablePreviewerPlugin }
