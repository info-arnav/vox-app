import path from 'node:path'
import { createReadStream } from 'node:fs'
import { readFile } from 'node:fs/promises'
import {
  IMAGE_EXTENSIONS,
  IMAGE_MIME_BY_EXTENSION,
  MAX_IMAGE_BYTES,
  MAX_TEXT_CHARS,
  TEXT_EXTENSIONS
} from './indexing.constants'

export const SUPPORTED_DOCUMENT_EXTENSIONS = new Set([
  '.pdf',
  '.docx',
  '.pptx',
  '.xlsx',
  '.odt',
  '.odp',
  '.ods',
  '.rtf'
])

export const LEGACY_OFFICE_EXTENSIONS = new Set(['.doc', '.docm', '.ppt', '.pptm', '.xls', '.xlsm'])

const STRUCTURED_TEXT_EXTENSIONS = new Set([
  ...SUPPORTED_DOCUMENT_EXTENSIONS,
  ...LEGACY_OFFICE_EXTENSIONS
])

let officeParserPromise = null

const getOfficeParser = async () => {
  if (!officeParserPromise) {
    officeParserPromise = import('officeparser').then((moduleValue) => {
      const parser =
        moduleValue?.parseOffice && typeof moduleValue.parseOffice === 'function'
          ? moduleValue
          : moduleValue?.default && typeof moduleValue.default.parseOffice === 'function'
            ? moduleValue.default
            : null

      if (!parser) {
        throw new Error('officeparser did not expose parseOffice.')
      }

      return parser
    })
  }

  return officeParserPromise
}

const clampTextLength = (rawText) => {
  const text = String(rawText || '')
  if (text.length <= MAX_TEXT_CHARS) {
    return {
      text,
      truncated: false
    }
  }

  return {
    text: text.slice(0, MAX_TEXT_CHARS),
    truncated: true
  }
}

const readStructuredTextForIndex = async (filePath) => {
  const officeParser = await getOfficeParser()
  const parsed = await officeParser.parseOffice(filePath, {
    outputErrorToConsole: false
  })

  const parserText = typeof parsed?.toText === 'function' ? parsed.toText() : ''
  const { text, truncated } = clampTextLength(parserText)

  return {
    text,
    truncated,
    containsBinary: false
  }
}

export const normalizeFolderList = (foldersInput) => {
  const normalizedFolders = Array.isArray(foldersInput)
    ? foldersInput.map((folder) => path.resolve(String(folder || '').trim())).filter(Boolean)
    : []

  return [...new Set(normalizedFolders)]
}

export const detectFileKind = (filePath) => {
  const extension = path.extname(filePath).toLowerCase()

  if (TEXT_EXTENSIONS.has(extension)) {
    return 'text'
  }

  if (IMAGE_EXTENSIONS.has(extension)) {
    return 'image'
  }

  return null
}

export const getImageMimeType = (filePath) => {
  const extension = path.extname(filePath).toLowerCase()
  return IMAGE_MIME_BY_EXTENSION[extension] || 'image/jpeg'
}

export const isUnchangedFile = (entry, stats, fileKind) => {
  if (!entry) {
    return false
  }

  return (
    Number(entry.mtimeMs) === Number(stats.mtimeMs) &&
    Number(entry.size) === Number(stats.size) &&
    String(entry.kind || '') === fileKind
  )
}

export const readTextFileForIndex = async (filePath) => {
  const extension = path.extname(filePath).toLowerCase()

  if (LEGACY_OFFICE_EXTENSIONS.has(extension)) {
    return {
      text: '',
      truncated: false,
      containsBinary: false,
      unsupported: true,
      unsupportedReason: `Legacy format ${extension} is not supported for text extraction. Convert to ${extension.startsWith('.doc') ? '.docx' : extension.startsWith('.ppt') ? '.pptx' : '.xlsx'} to enable reading.`
    }
  }

  if (SUPPORTED_DOCUMENT_EXTENSIONS.has(extension)) {
    try {
      return await readStructuredTextForIndex(filePath)
    } catch (err) {
      return {
        text: '',
        truncated: false,
        containsBinary: false,
        unsupported: true,
        unsupportedReason: `Failed to extract text from ${extension}: ${err?.message || 'unknown error'}`
      }
    }
  }

  if (STRUCTURED_TEXT_EXTENSIONS.has(extension)) {
    try {
      return await readStructuredTextForIndex(filePath)
    } catch {
      return {
        text: '',
        truncated: false,
        containsBinary: true
      }
    }
  }

  const stream = createReadStream(filePath, {
    encoding: 'utf8',
    highWaterMark: 64 * 1024
  })

  let text = ''
  let truncated = false
  let containsBinary = false

  try {
    for await (const chunk of stream) {
      if (chunk.includes('\u0000')) {
        containsBinary = true
        break
      }

      const availableChars = MAX_TEXT_CHARS - text.length
      if (availableChars <= 0) {
        truncated = true
        break
      }

      if (chunk.length <= availableChars) {
        text += chunk
      } else {
        text += chunk.slice(0, availableChars)
        truncated = true
        break
      }
    }
  } finally {
    stream.destroy()
  }

  return {
    text,
    truncated,
    containsBinary
  }
}

export const readImageFileForIndex = async (filePath, fileSize) => {
  if (Number(fileSize) > MAX_IMAGE_BYTES) {
    return {
      skipped: true,
      reason: `Image exceeds max supported size (${MAX_IMAGE_BYTES} bytes).`,
      base64: ''
    }
  }

  const imageBuffer = await readFile(filePath)

  return {
    skipped: false,
    reason: '',
    base64: imageBuffer.toString('base64')
  }
}
