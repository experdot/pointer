import { exportManager } from '../../ExportManager'
import { textPreviewerPlugin } from './textPreviewer'
import { htmlPreviewerPlugin } from './htmlPreviewer'
import { imagePreviewerPlugin } from './imagePreviewer'
import { tablePreviewerPlugin } from './tablePreviewer'

// Register all previewer plugins
export function registerPreviewerPlugins(): void {
  exportManager.registerPreviewer(textPreviewerPlugin)
  exportManager.registerPreviewer(htmlPreviewerPlugin)
  exportManager.registerPreviewer(imagePreviewerPlugin)
  exportManager.registerPreviewer(tablePreviewerPlugin)
}

// Re-export plugins
export { textPreviewerPlugin, htmlPreviewerPlugin, imagePreviewerPlugin, tablePreviewerPlugin }
