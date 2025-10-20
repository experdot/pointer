export type DrawMode =
  | 'none'
  | 'mosaic'
  | 'draw'
  | 'rect'
  | 'text'
  | 'eraser'
  | 'highlight'
  | 'arrow'

export interface TextItem {
  id: string
  x: number
  y: number
  width: number
  height: number
  text: string
  color: string
  size: number
  isEditing: boolean
}

export interface Point {
  x: number
  y: number
}

export const TOOL_DEFAULT_SIZES: Record<string, number> = {
  draw: 5,
  highlight: 24,
  mosaic: 24,
  rect: 4,
  arrow: 4,
  eraser: 20
}
