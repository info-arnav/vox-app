export const BUILTIN_TOOL_DEFINITIONS = [
  {
    name: 'capture_full_screen',
    description:
      "Capture a screenshot of the user's entire screen. Use this whenever the user asks you to look at, read, or help with something on their screen — including emails, documents, web pages, code, chat messages, forms, or any other visible content. The returned image contains the full screen rendered at the time of capture. You must read and analyze ALL visible text and UI elements in the image in detail, including the content of open applications, browser tabs, emails, and documents. Never say you cannot read text from an image — you have full vision capabilities and must extract and reason over all on-screen content.",
    parameters: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'list_indexed_files',
    description:
      'List indexed file paths from the local index manifest. Supports pagination, optional path prefix filtering, and optional fuzzy query matching by file/path.',
    parameters: {
      type: 'object',
      properties: {
        page: {
          type: 'integer',
          description: 'Page number starting from 1.'
        },
        pageSize: {
          type: 'integer',
          description: 'Number of files per page (max 200).'
        },
        prefix: {
          type: 'string',
          description: 'Optional absolute path prefix filter.'
        },
        query: {
          type: 'string',
          description: 'Optional case-insensitive substring query over file path and name.'
        }
      }
    }
  },
  {
    name: 'read_indexed_file',
    description:
      'Read file data by absolute path, restricted to indexed files only. Returns extracted text for supported formats.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Absolute file path present in indexed files.'
        },
        maxChars: {
          type: 'integer',
          description: 'Maximum characters to return (default 60000, max 120000).'
        }
      },
      required: ['path']
    }
  },
  {
    name: 'write_local_file',
    description:
      "Create or update a local file on the user's machine. Supports text and base64 payloads for binary files (docx, pptx, images, zip, etc.).",
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Target file path. Supports absolute paths and ~/ shortcuts.'
        },
        content: {
          type: 'string',
          description:
            'File content. For text files provide plain text. For binary writes, provide base64 content and set encoding to base64.'
        },
        encoding: {
          type: 'string',
          description: 'Content encoding: utf8 or base64. Defaults to utf8.'
        },
        append: {
          type: 'boolean',
          description:
            'Append content instead of overwrite. Defaults to false. For binary use with care.'
        },
        createParents: {
          type: 'boolean',
          description: 'Create missing parent directories automatically. Defaults to true.'
        }
      },
      required: ['path']
    }
  },
  {
    name: 'read_local_file',
    description:
      "Read a local file directly from the user's machine by path. Automatically extracts readable text from documents (PDF, DOCX, PPTX, XLSX, ODT, ODP, ODS, RTF). Supports plain text mode and base64 mode for other binary files.",
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Target file path. Supports absolute paths and ~/ shortcuts.'
        },
        maxChars: {
          type: 'integer',
          description: 'Maximum number of characters to return (default 60000, max 120000).'
        },
        maxBytes: {
          type: 'integer',
          description:
            'Maximum bytes to return when encoding is base64 (default 120000, max 500000).'
        },
        encoding: {
          type: 'string',
          description: 'Read encoding: utf8 or base64. Defaults to utf8.'
        }
      },
      required: ['path']
    }
  },
  {
    name: 'list_local_directory',
    description:
      "List files and folders from a local directory on the user's machine (ls-style output).",
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description:
            'Directory path to inspect. Supports absolute paths and ~/ shortcuts. Defaults to home directory.'
        },
        includeHidden: {
          type: 'boolean',
          description: 'Include dotfiles and hidden entries. Defaults to false.'
        },
        includeDetails: {
          type: 'boolean',
          description: 'Include size and modified timestamp for each entry. Defaults to true.'
        },
        limit: {
          type: 'integer',
          description: 'Maximum entries to return (default 300, max 2000).'
        }
      }
    }
  },
  {
    name: 'delete_local_path',
    description:
      "Delete a local file or folder on the user's machine. Use only when the user explicitly asks to delete/remove something.",
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Target file or folder path. Supports absolute paths and ~/ shortcuts.'
        },
        recursive: {
          type: 'boolean',
          description: 'Allow deleting directories recursively. Defaults to true.'
        },
        force: {
          type: 'boolean',
          description: 'Ignore missing files and best-effort delete. Defaults to false.'
        },
        dryRun: {
          type: 'boolean',
          description: 'Preview only without deleting. Defaults to false.'
        }
      },
      required: ['path']
    }
  },
  {
    name: 'run_local_command',
    description:
      "Run shell commands on the user's local machine (not sandbox). Supports commands like ls, cat, grep, find, rm, npm, npx, builds, package install, and scripts.",
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'Shell command to execute.'
        },
        cwd: {
          type: 'string',
          description:
            'Working directory path (absolute or ~/ shortcut). Defaults to home directory.'
        },
        timeoutMs: {
          type: 'integer',
          description: 'Execution timeout in milliseconds (default 120000, max 600000).'
        },
        maxOutputChars: {
          type: 'integer',
          description: 'Maximum output characters returned per stream (default 50000, max 200000).'
        }
      },
      required: ['command']
    }
  }
]
