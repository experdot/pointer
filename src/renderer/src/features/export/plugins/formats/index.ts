import { exportManager } from '../../ExportManager'
import { markdownFormatPlugin } from './markdownFormat'
import { txtFormatPlugin } from './txtFormat'
import { htmlFormatPlugin } from './htmlFormat'
import { csvFormatPlugin } from './csvFormat'

// Register all format plugins
export function registerFormatPlugins(): void {
  exportManager.registerFormat(markdownFormatPlugin)
  exportManager.registerFormat(txtFormatPlugin)
  exportManager.registerFormat(htmlFormatPlugin)
  exportManager.registerFormat(csvFormatPlugin)
}

// Re-export plugins
export { markdownFormatPlugin, txtFormatPlugin, htmlFormatPlugin, csvFormatPlugin }
