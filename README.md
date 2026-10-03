# Vespper × docx-editor

A chat beside an editable `.docx`: a Mastra agent edits the document through
[Vespper](https://vespper.com), and its edits appear in
[EigenPal's docx-editor](https://github.com/eigenpal/docx-editor) as tracked
changes.

Features:

- Suggestion cards to review, edit, and apply the agent's edits
- Live document updates through the docx-editor
  [document refresh API](https://www.docx-editor.dev/docs/2.x/guides/document-refresh)
- Selected text and pasted images as prompt context
- Multi-model selection

## Demo video

[![Watch the docx-editor demo on YouTube](https://img.youtube.com/vi/EHCSoiSnCd4/maxresdefault.jpg)](https://youtu.be/EHCSoiSnCd4)

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

Clone this repository, then install the dependencies:

```bash
git clone https://github.com/vespperhq/eigenpal-docx-editor.git
cd eigenpal-docx-editor
npm install
cp .env.example .env
```

Edit `.env` and add your Vespper key plus the key for the model provider you
want to use:

```bash
VESPPER_API_KEY=sk_live_your_key_here
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

By default, the agent proposes edits as suggestion cards that you accept or
reject. To have it apply edits to the document as it writes them, set:

```bash
USE_SUGGESTIONS=false
```

## 3. Run it

```bash
npm run dev
```

This starts the API server at `http://localhost:3001` and the web app at  
[http://localhost:5173](http://localhost:5173). Vite proxies `/api` and  
`/health` to the API server.

## Try an edit

1. Drop a `.docx` onto the right pane.
2. Ask the AI agent for an edit.
3. Optionally select text in the document to include it as context, or paste
   images into the prompt.

With suggestions **on**, each edit appears as a card in the chat while the agent writes it. Edit a card's text if you want, then accept or reject it, or use **Apply all**. Accepted edits land in the document as tracked changes and are
briefly highlighted. The agent is told which suggestions you accepted, edited,
or rejected on the next turn.

With suggestions off, the agent's edits stream into the document as tracked  
changes while it works.

## How it works

The API server follows Vespper's
[live-editing architecture](https://docs.vespper.com/live-editing/introduction): it runs an agent with the Vespper tools and handles each `old`/`new` pair
of an `edit_document` call as soon as the model finishes writing it.

- **Suggestion mode** (the default): each pair is proposed to the user in the chat without changing the document as a suggestion card. Accepted cards go to `POST /api/apply`, which applies them. See
  [Suggestions](https://docs.vespper.com/live-editing/suggestions).
- **Direct mode** (`USE_SUGGESTIONS=false`): each pair is applied right away.

In both modes, every change to the document reaches the browser as an
`edit_applied` event that carries the complete, **cumulative** `.docx` and its
revision number.

### Updating the editor

The browser loads each new file through the docx-editor
[document refresh API](https://www.docx-editor.dev/docs/2.x/guides/document-refresh),
for both agent turns and **Apply**:

1. `refresh.capture()` snapshots the document that goes to the server.
2. Each `edit_applied` event calls `refresh.applyUpdate()`, which swaps in the
   new file and keeps the scroll position.
3. `refresh.highlightChanges()` flashes the new tracked changes.
4. `refresh.finish()` closes the update.

The document is read-only while an update runs. The code is in
`src/agent/updateQueue.ts`.

## Development commands

| Command             | Purpose                                     |
| ------------------- | ------------------------------------------- |
| `npm run dev`       | Run the API server and the Vite dev server  |
| `npm start`         | Build the web app and serve it from the API |
| `npm run build`     | Build the web app into `dist/`              |
| `npm test`          | Run the suggestion card tests               |
| `npm run typecheck` | Type-check the server and the web app       |

## Project layout

```text
eigenpal-docx-editor/
├── server/          Express API server and Mastra agent
├── shared/          Message contracts shared by client and server
├── src/
│   ├── agent/       Streaming client and document refresh queue
│   ├── chat/        Chat panel and agent trace rendering
│   ├── context/     ChatProvider and the hooks that read its state
│   ├── document/    docx-editor pane, drop zone, and download
│   ├── hooks/       Conversation, suggestions, selection, and editor actions
│   └── suggestions/ Suggestion cards, their editor, and the apply client
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
