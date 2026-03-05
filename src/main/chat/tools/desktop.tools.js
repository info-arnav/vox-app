import { TOOL_DEFINITIONS } from './desktop.tool.defs'
import { createWordDocument } from './desktop.tool.word'
import { createPdfDocument } from './desktop.tool.pdf'
import { createPresentationDocument } from './desktop.tool.pptx'
import { readLocalFile, writeLocalFile } from './desktop.tool.fs.io'
import { deleteLocalPath, listLocalDirectory } from './desktop.tool.fs.directory'
import { runLocalCommand } from './desktop.tool.fs.command'
import { captureFullScreen } from './desktop.tool.screen'
import { listIndexedFiles, readIndexedFile } from './desktop.tool.snapshot'

const TOOL_EXECUTORS = {
  capture_full_screen: captureFullScreen,
  list_indexed_files: listIndexedFiles,
  read_indexed_file: readIndexedFile,
  write_local_file: writeLocalFile,
  read_local_file: readLocalFile,
  list_local_directory: listLocalDirectory,
  delete_local_path: deleteLocalPath,
  run_local_command: runLocalCommand,
  create_word_document: createWordDocument,
  create_pdf_document: createPdfDocument,
  create_presentation_document: createPresentationDocument
}

export const DESKTOP_TOOL_DECLARATIONS = TOOL_DEFINITIONS

export const runDesktopTool = async (toolName, payload) => {
  const executor = TOOL_EXECUTORS[String(toolName || '')]
  if (!executor) {
    throw new Error(`Unknown desktop tool: ${toolName}`)
  }

  return executor(payload || {})
}
