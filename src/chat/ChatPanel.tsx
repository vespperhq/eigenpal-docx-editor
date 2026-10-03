import { ChatInputBar } from "./ChatInputBar";
import { Conversation } from "./Conversation";

export function ChatPanel() {
  return (
    <aside className="flex h-full min-h-0 flex-col bg-background">
      <Conversation />
      <ChatInputBar />
    </aside>
  );
}
