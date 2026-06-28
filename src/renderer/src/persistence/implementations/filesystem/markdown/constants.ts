/**
 * Markdown format constants
 * Defines unique separators that are unlikely to appear in regular markdown content
 */

/**
 * Message header prefix - marks the start of a message metadata block
 * This unique comment ensures message headers won't be confused with user content
 */
export const MESSAGE_HEADER_PREFIX = '<!-- [POINTER-MSG] -->'

/**
 * Message separator - used between messages
 * This decorative separator is unlikely to appear in regular markdown
 */
export const MESSAGE_SEPARATOR = '\n\n<!-- ═══════════ -->\n\n'

/**
 * Page metadata start marker
 */
export const PAGE_META_START = '<!--\n<page>'

/**
 * Page metadata end marker
 */
export const PAGE_META_END = '</page>\n-->'

/**
 * Message metadata start marker
 */
export const MESSAGE_META_START = '<!--\n<message>'

/**
 * Message metadata end marker
 */
export const MESSAGE_META_END = '</message>\n-->'
