export const TEXT_EXTENSIONS = new Set([
  '.txt',
  '.md',
  '.mdx',
  '.adoc',
  '.asciidoc',
  '.json',
  '.yaml',
  '.yml',
  '.toml',
  '.ini',
  '.env',
  '.csv',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.py',
  '.go',
  '.java',
  '.rb',
  '.rs',
  '.c',
  '.cpp',
  '.h',
  '.hpp',
  '.css',
  '.scss',
  '.less',
  '.html',
  '.htm',
  '.xml',
  '.sql',
  '.graphql',
  '.gql',
  '.sh',
  '.zsh',
  '.bash',
  '.pdf',
  '.doc',
  '.docx',
  '.docm',
  '.ppt',
  '.pptx',
  '.pptm',
  '.xls',
  '.xlsx',
  '.xlsm',
  '.odt',
  '.odp',
  '.ods',
  '.rtf'
])

export const IMAGE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.bmp',
  '.tif',
  '.tiff'
])

export const IMAGE_MIME_BY_EXTENSION = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff'
}

export const IGNORED_DIRECTORIES = new Set([
  '.git',
  '.hg',
  '.svn',
  'node_modules',
  '.next',
  '.turbo',
  'dist',
  'build',
  'out',
  'coverage',
  '.cache',
  '.idea',
  '.vscode'
])

export const MAX_TEXT_CHARS = 512_000
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const MAX_QUEUE_SIZE = 200
export const WORKER_CONCURRENCY = 4
export const MAX_RETRY_ATTEMPTS = 2
export const REMOVE_BATCH_SIZE = 200
export const DELETE_DRAIN_RETRY_DELAY_MS = 15_000
export const STATUS_EVENT_LIMIT = 120
