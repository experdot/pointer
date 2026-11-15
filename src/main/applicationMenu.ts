import { Menu, shell, type MenuItemConstructorOptions } from 'electron'
import type { Translate } from '@shared/i18n'
import type { TranslationKey } from '@shared/i18n/resources'

/** 使用显式文案覆盖 Electron 默认英文菜单，同时保留原生编辑与窗口操作。 */
export function installApplicationMenu(t: Translate, platform = process.platform): void {
  const item = (
    role: MenuItemConstructorOptions['role'],
    key: TranslationKey
  ): MenuItemConstructorOptions => ({ role, label: t(key) })
  const separator: MenuItemConstructorOptions = { type: 'separator' }
  const isMac = platform === 'darwin'
  const template: MenuItemConstructorOptions[] = []

  if (isMac) {
    template.push({
      label: 'Pointer',
      role: 'appMenu',
      submenu: [
        item('about', 'native.menu.about'),
        separator,
        item('services', 'native.menu.services'),
        separator,
        item('hide', 'native.menu.hide'),
        item('hideOthers', 'native.menu.hideOthers'),
        item('unhide', 'native.menu.showAll'),
        separator,
        item('quit', 'native.menu.quit')
      ]
    })
  }

  template.push(
    {
      label: t('native.menu.file'),
      role: 'fileMenu',
      submenu: [isMac ? item('close', 'native.menu.closeWindow') : item('quit', 'native.menu.quit')]
    },
    {
      label: t('native.menu.edit'),
      role: 'editMenu',
      submenu: [
        item('undo', 'native.menu.undo'),
        item('redo', 'native.menu.redo'),
        separator,
        item('cut', 'native.menu.cut'),
        item('copy', 'common.copy'),
        item('paste', 'native.menu.paste'),
        item('pasteAndMatchStyle', 'native.menu.pastePlainText'),
        item('delete', 'common.delete'),
        separator,
        item('selectAll', 'common.selectAll')
      ]
    },
    {
      label: t('native.menu.view'),
      role: 'viewMenu',
      submenu: [
        item('reload', 'common.reload'),
        item('forceReload', 'native.menu.forceReload'),
        item('toggleDevTools', 'native.menu.devTools'),
        separator,
        item('resetZoom', 'native.menu.actualSize'),
        item('zoomIn', 'native.menu.zoomIn'),
        item('zoomOut', 'native.menu.zoomOut'),
        separator,
        item('togglefullscreen', 'native.menu.fullscreen')
      ]
    },
    {
      label: t('native.menu.window'),
      role: 'windowMenu',
      submenu: [
        item('minimize', 'native.menu.minimize'),
        item('zoom', 'native.menu.zoomWindow'),
        ...(isMac ? [separator, item('front', 'native.menu.bringAllToFront')] : []),
        item('close', 'native.menu.closeWindow')
      ]
    },
    {
      label: t('native.menu.help'),
      role: 'help',
      submenu: [
        ...(!isMac ? [item('about', 'native.menu.about')] : []),
        {
          label: t('native.menu.project'),
          click: () => {
            void shell.openExternal('https://github.com/experdot/pointer').catch((error) => {
              console.warn('[menu] 打开项目主页失败：', error)
            })
          }
        }
      ]
    }
  )
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
