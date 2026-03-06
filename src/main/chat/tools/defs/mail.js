export const MAIL_TOOL_DEFINITIONS = [
  {
    name: 'read_emails',
    description:
      "Read emails from the user's local mail client (Mail.app on macOS, Outlook on Windows, Thunderbird/mbox on Linux). Returns a list of messages with sender, subject, date and read status. Use this when the user asks to check, read, or search their email.",
    parameters: {
      type: 'object',
      properties: {
        folder: {
          type: 'string',
          description:
            'Mailbox folder name to read from. Default is "INBOX". Other examples: "Sent", "Drafts".'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of emails to return. Default 10, max 50.'
        },
        unread_only: {
          type: 'boolean',
          description: 'If true, only return unread emails. Default false.'
        },
        search: {
          type: 'string',
          description: 'Optional keyword to filter results by sender or subject. Case-insensitive.'
        }
      },
      required: []
    }
  },
  {
    name: 'search_contacts',
    description:
      "Search the user's local system contacts (Contacts.app on macOS, Outlook / Windows Contacts on Windows, GNOME Contacts / abook on Linux) by name. Returns matching contacts with their email addresses. Call this before send_email whenever the user refers to a person by name rather than a full email address.",
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'Name (or partial name) to search for. Case-insensitive. Examples: "Sara", "John Smith".'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'send_email',
    description:
      "Send an email from the user's default mail client. On macOS this sends silently via Mail.app. On Windows it sends via Outlook (if installed) or opens the default mail client. On Linux it opens Thunderbird or the default mail client. Always call search_contacts first if you only know the recipient's name, not their full email address.",
    parameters: {
      type: 'object',
      properties: {
        to: {
          type: 'string',
          description:
            'Recipient email address or comma-separated list of addresses. Must be fully resolved email addresses (e.g. sara@example.com), not names. Use search_contacts first if needed.'
        },
        subject: {
          type: 'string',
          description: 'Email subject line.'
        },
        body: {
          type: 'string',
          description: 'Plain text email body.'
        },
        cc: {
          type: 'string',
          description: 'Optional CC email address or comma-separated list.'
        },
        bcc: {
          type: 'string',
          description: 'Optional BCC email address or comma-separated list.'
        },
        attachments: {
          type: 'string',
          description:
            'Optional comma-separated list of absolute local file paths to attach. Supports ~/ shortcuts.'
        }
      },
      required: ['to', 'subject', 'body']
    }
  }
]
