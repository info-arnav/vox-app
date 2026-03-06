import { TOOL_DEFINITIONS } from './defs'
import { createWordDocument } from './docs/word'
import { createPdfDocument } from './docs/pdf'
import { createPresentationDocument } from './docs/pptx'
import { readLocalFile, writeLocalFile } from './fs/io'
import { deleteLocalPath, listLocalDirectory } from './fs/directory'
import { runLocalCommand } from './fs/command'
import { captureFullScreen } from './screen'
import { listIndexedFiles, readIndexedFile } from './snapshot'
import { sendEmail, searchContacts } from './mail'

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
  create_presentation_document: createPresentationDocument,
  send_email: sendEmail,
  search_contacts: searchContacts
}

export const DESKTOP_TOOL_DECLARATIONS = TOOL_DEFINITIONS

export const runDesktopTool = async (toolName, payload) => {
  const executor = TOOL_EXECUTORS[String(toolName || '')]
  if (!executor) {
    throw new Error(`Unknown desktop tool: ${toolName}`)
  }

  return executor(payload || {})
}
