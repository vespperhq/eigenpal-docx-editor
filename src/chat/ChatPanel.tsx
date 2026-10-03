import { useState } from "react";
import type { AgentTurn } from "../agent/useAgentTurn";
import { ChatInputBar } from "./ChatInputBar";
import { Conversation } from "./Conversation";
import { useImageAttachments } from "./useImageAttachments";
import type { ModelSelection } from "./useModels";

type ChatPanelProps = {
  agent: AgentTurn;
  models: ModelSelection;
  disabled: boolean;
};

export function ChatPanel({ agent, models, disabled }: ChatPanelProps) {
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
      <Conversation
        turns={agent.turns}
        hasDocument={!disabled}
        onTogglePart={agent.togglePart}
      />
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
        disabled={disabled}
        onSend={send}
        onStop={agent.stop}
      />
    </aside>
  );
}
