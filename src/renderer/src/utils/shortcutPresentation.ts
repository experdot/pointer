import type { DropdownProps } from 'antd'

export type ShortcutLabelId =
  | 'treeRename'
  | 'treeDelete'
  | 'tabNew'
  | 'tabClose'
  | 'toggleSidebar'
  | 'globalSearch'
  | 'tabNext'
  | 'tabPrev'
  | 'editorNext'
  | 'editorPrev'
  | 'tabHistoryBack'
  | 'tabHistoryForward'
  | 'chatFind'
  | 'findMatchCase'
  | 'findRegex'
  | 'findWholeWord'
  | 'messageCopy'
  | 'messagePrev'
  | 'messageNext'
  | 'messageFirst'
  | 'messageLast'

type DisplayPlatform = 'darwin' | 'linux' | 'windows'

const STANDARD_MENU_MIN_WIDTH = 180
const STANDARD_DROPDOWN_CLASS_NAME = 'app-standard-dropdown-menu'

let cachedDisplayPlatform: DisplayPlatform | null = null

function mergeClassNames(...values: Array<string | undefined>): string | undefined {
  const filtered = values.filter(Boolean)
  return filtered.length > 0 ? filtered.join(' ') : undefined
}

function resolveDisplayPlatform(): DisplayPlatform {
  if (cachedDisplayPlatform) {
    return cachedDisplayPlatform
  }

  if (typeof navigator === 'undefined') {
    cachedDisplayPlatform = 'windows'
    return cachedDisplayPlatform
  }

  const navigatorWithUserAgentData = navigator as Navigator & {
    userAgentData?: { platform?: string }
  }
  const platformHint = [
    navigatorWithUserAgentData.userAgentData?.platform,
    navigator.platform,
    navigator.userAgent
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  if (platformHint.includes('mac')) {
    cachedDisplayPlatform = 'darwin'
  } else if (platformHint.includes('linux')) {
    cachedDisplayPlatform = 'linux'
  } else {
    cachedDisplayPlatform = 'windows'
  }
  return cachedDisplayPlatform
}

export function isMacPlatform(): boolean {
  return resolveDisplayPlatform() === 'darwin'
}

export function isLinuxPlatform(): boolean {
  return resolveDisplayPlatform() === 'linux'
}

export function isWindowsPlatform(): boolean {
  return resolveDisplayPlatform() === 'windows'
}

export function getShortcutLabel(id: ShortcutLabelId): string {
  const platform = resolveDisplayPlatform()
  const isMac = platform === 'darwin'
  const modifier = isMac ? 'Cmd' : 'Ctrl'

  switch (id) {
    case 'treeRename':
      return isMac ? 'Enter' : 'F2'
    case 'treeDelete':
      return isMac ? 'Cmd+⌫' : 'Del'
    case 'tabNew':
      return `${modifier}+N`
    case 'tabClose':
      return `${modifier}+W`
    case 'toggleSidebar':
      return `${modifier}+B`
    case 'globalSearch':
      return `${modifier}+Shift+F`
    case 'tabNext':
      return 'Ctrl+Tab'
    case 'tabPrev':
      return 'Ctrl+Shift+Tab'
    case 'editorNext':
      return isMac ? 'Cmd+Alt+→' : 'Ctrl+PageDown'
    case 'editorPrev':
      return isMac ? 'Cmd+Alt+←' : 'Ctrl+PageUp'
    case 'tabHistoryBack':
      // 与 VS Code 一致：Win 用 Alt+←，macOS 用 Ctrl+-，Linux 用 Ctrl+Alt+-
      if (isMac) return 'Ctrl+-'
      if (platform === 'linux') return 'Ctrl+Alt+-'
      return 'Alt+←'
    case 'tabHistoryForward':
      if (isMac) return 'Ctrl+Shift+-'
      if (platform === 'linux') return 'Ctrl+Shift+-'
      return 'Alt+→'
    case 'findMatchCase':
      return isMac ? 'Cmd+Alt+C' : 'Alt+C'
    case 'findRegex':
      return isMac ? 'Cmd+Alt+R' : 'Alt+R'
    case 'findWholeWord':
      return isMac ? 'Cmd+Alt+W' : 'Alt+W'
    case 'chatFind':
      return `${modifier}+F`
    case 'messageCopy':
      return `${modifier}+C`
    case 'messagePrev':
      return 'Shift+Space'
    case 'messageNext':
      return 'Space'
    case 'messageFirst':
      return 'Home'
    case 'messageLast':
      return 'End'
  }
}

export function formatShortcutTooltip(label: string, shortcutId: ShortcutLabelId): string {
  return `${label} (${getShortcutLabel(shortcutId)})`
}

export function withStandardMenu(
  menu: NonNullable<DropdownProps['menu']>
): NonNullable<DropdownProps['menu']> {
  return {
    ...menu,
    rootClassName: mergeClassNames(menu.rootClassName, STANDARD_DROPDOWN_CLASS_NAME),
    style: {
      minWidth: STANDARD_MENU_MIN_WIDTH,
      ...(menu.style ?? {})
    }
  }
}

export function getStandardDropdownProps(
  menu: NonNullable<DropdownProps['menu']>
): Pick<DropdownProps, 'menu' | 'overlayClassName'> {
  return {
    menu: withStandardMenu(menu),
    overlayClassName: STANDARD_DROPDOWN_CLASS_NAME
  }
}
