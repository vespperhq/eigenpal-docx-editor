# Vespper × docx-editor

A browser-based Word editing example: a chat on the left, an editable `.docx`
on the right. A Mastra agent edits the document through
[Vespper](https://vespper.com), and every committed edit streams into
[EigenPal's docx-editor](https://github.com/eigenpal/docx-editor) as a tracked
change, while the agent is still working.

The example includes the following features:

- Drag-and-drop `.docx` loading
- Streamed edits through the docx-editor [document refresh API](https://www.docx-editor.dev/docs/2.x/guides/document-refresh)
- Pasted image context
- Multi-model selection
- Stop and download

## Prerequisites

- Node.js 22.13 or newer
- A [Vespper account](https://app.vespper.com)
- A model-provider API key for OpenAI, Anthropic, or Google

## 1. Get a Vespper API key

1. [Sign up for Vespper](https://app.vespper.com).
2. Open the [API keys page](https://app.vespper.com/keys).
3. Create a key and copy the `sk_live_...` secret immediately. It is shown only
   once.

## 2. Install the example

From the repository root:

```bash
cd docx-editor
npm install
cp .env.example .env
```

Edit `.env` and add your Vespper key plus the key for the model provider you
want to use:

```bash
VESPPER_API_KEY=sk_live_your_key_here
VESPPER_MCP_URL=https://mcp.vespper.com/mcp
OPENAI_API_KEY=sk-your_openai_key_here
```

Only one model-provider key is required:

| Model family     | Environment variable                               |
| ---------------- | -------------------------------------------------- |
| OpenAI GPT       | `OPENAI_API_KEY`                                   |
| Anthropic Claude | `ANTHROPIC_API_KEY`                                |
| Google Gemini    | `GOOGLE_API_KEY` or `GOOGLE_GENERATIVE_AI_API_KEY` |

OpenAI GPT 5.6 Sol is the default. To start with another model, set
`DOCX_AGENT_MODEL` in `.env`, for example:

```bash
DOCX_AGENT_MODEL=anthropic/claude-sonnet-4.5
```

## 3. Run it

```bash
npm run dev
```

This starts the API server at `http://localhost:3001` and the web app at
[http://localhost:5173](http://localhost:5173). Vite proxies `/api` and
`/health` to the API server.

To verify configuration, open
[http://localhost:5173/health](http://localhost:5173/health). Both
`vespperConfigured` and `agentConfigured` should be `true`.

## Try an edit

1. Drop a `.docx` onto the right pane, or use **Open .docx**.
2. Ask for an edit, for example `Change the effective date to January 1, 2027`.
3. Optionally paste images into the prompt.

The agent's edits appear as tracked changes while it works, and each new edit
is briefly highlighted. The document is read-only during a run. Use the review
rail to accept or reject changes, and **Download .docx** to save the result
with its tracked changes.

## How it works

The API server opens and closes a Vespper document session for each turn with
the `vespper` SDK, and auto-patches Mastra's MCP tools so reads, searches, and
edits carry the correct session and tracked-change metadata. It wraps
`edit_document` to parse streamed edit arguments, so edits apply while the
model is still writing them. Every committed revision is sent to the browser as
an `edit_applied` event carrying the complete, cumulative `.docx`.

In the browser, each turn follows the document refresh flow:

1. `refresh.capture()` snapshots the current document, and those bytes go to
   `POST /api/process` with the conversation.
2. Each `edit_applied` event calls
   `refresh.applyUpdate({ submission, sequence: revision, bytes })`. The editor
   swaps the document without remounting and keeps the scroll position. If
   several revisions arrive during one replacement, only the newest is loaded.
3. `refresh.highlightChanges()` flashes the new tracked revisions. The review
   module finds them in the returned file; nothing is diffed in the browser.
4. `refresh.finish(submission)` closes the turn. **Stop** aborts the request
   and calls `refresh.cancel()`.

Each accepted update resets the editor's selection and undo history.

## Development commands

| Command             | Purpose                                     |
| ------------------- | ------------------------------------------- |
| `npm run dev`       | Run the API server and the Vite dev server  |
| `npm start`         | Build the web app and serve it from the API |
| `npm run build`     | Build the web app into `dist/`              |
| `npm run typecheck` | Type-check the server and the web app       |

## Project layout

```text
docx-editor/
├── server/          Express API server and Mastra agent
├── shared/          Message contracts shared by client and server
├── src/
│   ├── agent/       Streaming client and document refresh orchestration
│   ├── chat/        Chat panel and agent trace rendering
│   └── document/    docx-editor pane, drop zone, and download
├── .env.example
└── package.json
```

## Licensing

This example is [MIT](./LICENSE) licensed. It depends on
`@docx-editor.dev/pro` for tracked-change rendering and the review rail, which
is distributed under the
[EigenPal Pro Evaluation License](https://www.docx-editor.dev/docs/2.x/pro#licensing):
internal, non-production evaluation only. Contact EigenPal for a production
license. Without the review module, docx-editor shows revisions in their
accepted state and keeps them in the saved file.

## Security

`.env` is ignored by Git. Vespper and model-provider keys are read only by the
local Node.js server and are never bundled into the web app.
