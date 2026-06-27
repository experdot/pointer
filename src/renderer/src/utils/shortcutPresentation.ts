import type { DropdownProps } from 'antd'

export type ShortcutLabelId =
  | 'treeRename'
  | 'treeDelete'
  | 'tabNew'
  | 'tabClose'
  | 'messageCopy'
  | 'messagePrev'
  | 'messageNext'

type DisplayPlatform = 'darwin' | 'default'

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
    cachedDisplayPlatform = 'default'
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

  cachedDisplayPlatform = platformHint.includes('mac') ? 'darwin' : 'default'
  return cachedDisplayPlatform
}

export function getShortcutLabel(id: ShortcutLabelId): string {
  const modifier = resolveDisplayPlatform() === 'darwin' ? 'Cmd' : 'Ctrl'

  switch (id) {
    case 'treeRename':
      return 'F2'
    case 'treeDelete':
      return 'Del'
    case 'tabNew':
      return `${modifier}+N`
    case 'tabClose':
      return `${modifier}+W`
    case 'messageCopy':
      return `${modifier}+C`
    case 'messagePrev':
      return 'Shift+Space'
    case 'messageNext':
      return 'Space'
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
