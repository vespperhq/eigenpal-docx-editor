import { useState } from "react";
import type { AgentTurn } from "../agent/useAgentTurn";
import { SuggestionsProvider } from "../suggestions/SuggestionsContext";
import type { Suggestions } from "../suggestions/useSuggestions";
import { ChatInputBar } from "./ChatInputBar";
import { Conversation } from "./Conversation";
import { useImageAttachments } from "./useImageAttachments";
import type { ModelSelection } from "./useHealth";

type ChatPanelProps = {
  agent: AgentTurn;
  suggestions: Suggestions;
  models: ModelSelection;
  disabled: boolean;
};

export function ChatPanel({
  agent,
  suggestions,
  models,
  disabled,
}: ChatPanelProps) {
  const [instruction, setInstruction] = useState("");
  const attachments = useImageAttachments();

  function send() {
    const text = instruction.trim();
    const images = attachments.images;
    setInstruction("");
    attachments.clearImages();
    void agent.send(text, images);
  }

  return (
    <aside className="flex min-h-0 flex-col border-r border-border bg-muted">
      <SuggestionsProvider
        value={{ suggestions, enabled: models.suggestions, busy: agent.busy }}
      >
        <Conversation
          turns={agent.turns}
          hasDocument={!disabled}
          onTogglePart={agent.togglePart}
        />
      </SuggestionsProvider>
      <ChatInputBar
        instruction={instruction}
        setInstruction={setInstruction}
        images={attachments.images}
        imageError={attachments.imageError}
        imagesLoading={attachments.imagesLoading}
        addPastedImages={attachments.addPastedImages}
        removeImage={attachments.removeImage}
        models={models}
        busy={agent.busy}
        disabled={disabled || suggestions.applying}
        onSend={send}
        onStop={agent.stop}
      />
    </aside>
  );
}
