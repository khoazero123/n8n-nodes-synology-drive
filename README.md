# n8n-nodes-synology-drive

An n8n community node for Synology Drive. Automate file operations on your NAS from n8n workflows.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform. Synology Drive API docs: [Synology Drive API v1](https://office-suite-api.synology.com/Synology-Drive/v1)

- [Installation](#installation)
- [Credentials](#credentials)
- [What it can do](#what-it-can-do)
- [Quick start](#quick-start)
- [Compatibility](#compatibility)
- [Development](#development)
- [Resources](#resources)

## Installation

Follow the n8n Community Nodes installation guide: https://docs.n8n.io/integrations/community-nodes/installation/

Package name: `n8n-nodes-synology-drive`

## Credentials

Use the credential type **Synology Drive API** and provide:
- NAS URL (e.g. `https://192.168.1.100:5000`)
- DSM username and password
- Optionally allow self-signed certificates

The credential logs in to obtain a session and uses it for subsequent calls.

## What it can do

With this node you can:
- List and search files/folders
- Upload files from binary data
- Create files (text) and folders
- Download files as binary output
- Delete files or folders (soft or permanent)

Notes:
- `path` supports Synology Drive style paths like `/mydrive/...` or `/team-folders/<name>/...`.

## Quick start

1) Install the package following the n8n Community Nodes guide
2) Create a credential of type "Synology Drive API"
3) Add the Synology Drive node and choose an operation (e.g. Upload, Get Files, Download)
4) Provide the target `path` and other required fields

## Compatibility

- Node.js: >= 20.15
- n8n: 1.x (community node)
- Synology Drive: Office Suite API v1 endpoints

## Resources

- n8n Community Nodes guide: [Installation](https://docs.n8n.io/integrations/community-nodes/installation/)
- Synology Drive API docs: [Synology Drive API v1](https://office-suite-api.synology.com/Synology-Drive/v1)
- Project repository: [khoazero123/n8n-nodes-synology-drive](https://github.com/khoazero123/n8n-nodes-synology-drive)

## License

MIT
