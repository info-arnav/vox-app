import { listIndexedFilesForTool, readIndexedFileForTool } from '../../indexing/indexing.service'

export const listIndexedFiles = async (payload) => {
  return listIndexedFilesForTool(payload || {})
}

export const readIndexedFile = async (payload) => {
  return readIndexedFileForTool(payload || {})
}
