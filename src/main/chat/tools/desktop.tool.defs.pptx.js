export const PPTX_TOOL_DEFINITIONS = [
  {
    name: 'create_presentation_document',
    description:
      "Create or overwrite a styled PowerPoint .pptx file on the user's local machine with slide-level formatting. IMPORTANT: each call overwrites the file — you will lose previous slides. Always include ALL slides in one call. To build a multi-slide deck across steps, use append=true on intermediate calls and finalize=true on the last call to batch all slides into one write. Do not call with path/title only; include slide content via slides/content/body/text/markdown.",
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description:
            'Target .pptx path. Supports absolute paths and ~/ shortcuts. If no extension is provided, .pptx is appended.'
        },
        filePath: {
          type: 'string',
          description: 'Alias of path.'
        },
        targetPath: {
          type: 'string',
          description: 'Alias of path.'
        },
        directory: {
          type: 'string',
          description: 'Optional output directory used with filename when path is not set.'
        },
        filename: {
          type: 'string',
          description: 'Optional output filename used with directory when path is not set.'
        },
        title: {
          type: 'string',
          description:
            'Optional deck title metadata. By default this does not create an extra title slide. Title alone is not enough; provide slide content too.'
        },
        includeTitleSlide: {
          type: 'boolean',
          description:
            'When true, adds a separate title slide at the beginning using title text. Defaults to false.'
        },
        content: {
          type: 'string',
          description:
            'Slide content text. Use \\n---\\n as slide separators. Inside each slide block, first line acts as slide title. Aliases body/text/markdown are also accepted.'
        },
        body: {
          type: 'string',
          description: 'Alias of content.'
        },
        text: {
          type: 'string',
          description: 'Alias of content.'
        },
        markdown: {
          type: 'string',
          description: 'Alias of content.'
        },
        slides: {
          type: 'array',
          description:
            'Optional structured slide list. Prefer this over plain content for detailed deck styling.',
          items: {
            type: 'object',
            properties: {
              title: {
                type: 'string',
                description: 'Slide title.'
              },
              subtitle: {
                type: 'string',
                description: 'Optional subtitle.'
              },
              body: {
                type: 'string',
                description: 'Body paragraph text.'
              },
              bullets: {
                type: 'array',
                description: 'Bullet list items.',
                items: {
                  type: 'string'
                }
              },
              style: {
                type: 'object',
                description: 'Per-slide style overrides.',
                properties: {
                  backgroundColor: {
                    type: 'string',
                    description: 'Slide background color (hex).'
                  },
                  titleColor: {
                    type: 'string',
                    description: 'Slide title color (hex).'
                  },
                  subtitleColor: {
                    type: 'string',
                    description: 'Slide subtitle color (hex).'
                  },
                  bodyColor: {
                    type: 'string',
                    description: 'Slide body text color (hex).'
                  },
                  accentColor: {
                    type: 'string',
                    description: 'Slide accent line color (hex).'
                  },
                  titleSize: {
                    type: 'number',
                    description: 'Slide title size in points.'
                  },
                  subtitleSize: {
                    type: 'number',
                    description: 'Subtitle size in points.'
                  },
                  bodySize: {
                    type: 'number',
                    description: 'Body and bullet size in points.'
                  },
                  titleFontFace: {
                    type: 'string',
                    description: 'Slide title font family.'
                  },
                  bodyFontFace: {
                    type: 'string',
                    description: 'Slide body font family.'
                  },
                  layout: {
                    type: 'string',
                    description: 'Layout mode: standard or split.'
                  }
                }
              }
            }
          }
        },
        theme: {
          type: 'object',
          description: 'Optional deck-wide defaults.',
          properties: {
            backgroundColor: {
              type: 'string',
              description: 'Default slide background color (hex).'
            },
            titleColor: {
              type: 'string',
              description: 'Default title color (hex).'
            },
            subtitleColor: {
              type: 'string',
              description: 'Default subtitle color (hex).'
            },
            bodyColor: {
              type: 'string',
              description: 'Default body color (hex).'
            },
            accentColor: {
              type: 'string',
              description: 'Default accent line color (hex).'
            },
            titleSize: {
              type: 'number',
              description: 'Default title size in points.'
            },
            subtitleSize: {
              type: 'number',
              description: 'Default subtitle size in points.'
            },
            bodySize: {
              type: 'number',
              description: 'Default body size in points.'
            },
            titleFontFace: {
              type: 'string',
              description: 'Default title font family.'
            },
            bodyFontFace: {
              type: 'string',
              description: 'Default body font family.'
            },
            layout: {
              type: 'string',
              description: 'Default layout mode: standard or split.'
            }
          }
        },
        createParents: {
          type: 'boolean',
          description: 'Create missing parent directories automatically. Defaults to true.'
        },
        append: {
          type: 'boolean',
          description:
            'When true, new slides are queued after any slides already staged for this path. Use with finalize=false on intermediate calls and finalize=true on the final call to write the complete deck in one shot.'
        },
        finalize: {
          type: 'boolean',
          description:
            'When true (default), writes all staged slides to disk immediately. Set to false when more slides will follow via append=true.'
        }
      },
      required: ['path']
    }
  }
]
