export const MAIL_TOOL_DEFINITIONS = [
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
