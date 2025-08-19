# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.2] - 2025-08-19

### Added
- Initial Synology Drive community node for n8n
- Credential: `Synology Drive API` with login flow to obtain session cookie (`sid`)
- Resource: File
  - Get Files (list directory contents with sort, pagination, and optional filters)
  - Search (by keyword with sort and pagination)
  - List Items Recently Used
  - Create File Or Folder (supports text file content)
  - Upload (binary, multipart/form-data; conflict actions supported)
  - Download File (returns binary data; preserves filename and mime type)
  - Delete File Or Folder (soft or permanent)

### Notes
- Additional resources (File and Folder Sharing, Team Folder, Label) are scaffolded in the UI for future expansion.

---

## Previous Releases

For releases prior to v0.0.2, please refer to the git commit history.
