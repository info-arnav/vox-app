import { BUILTIN_TOOL_DEFINITIONS } from './desktop.tool.defs.builtin'
import { WORD_TOOL_DEFINITIONS } from './desktop.tool.defs.word'
import { PDF_TOOL_DEFINITIONS } from './desktop.tool.defs.pdf'
import { PPTX_TOOL_DEFINITIONS } from './desktop.tool.defs.pptx'

export const TOOL_DEFINITIONS = [
  ...BUILTIN_TOOL_DEFINITIONS,
  ...WORD_TOOL_DEFINITIONS,
  ...PDF_TOOL_DEFINITIONS,
  ...PPTX_TOOL_DEFINITIONS
]

export {
  BUILTIN_TOOL_DEFINITIONS,
  WORD_TOOL_DEFINITIONS,
  PDF_TOOL_DEFINITIONS,
  PPTX_TOOL_DEFINITIONS
}
