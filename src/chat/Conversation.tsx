import { useRef } from "react";
import { useConversation, useDocument } from "../context/ChatContext";
import { useStickToBottom } from "../hooks/useStickToBottom";
import { TraceTurn } from "./TraceTurn";

export function Conversation() {
  const { turns, togglePart } = useConversation();
  const { file } = useDocument();
  const conversationRef = useRef<HTMLDivElement>(null);
  const last = turns[turns.length - 1];
  useStickToBottom(conversationRef, [
    turns.length,
    last?.parts.length,
    last?.summary,
    last?.working,
  ]);

  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pt-4 pb-4"
      ref={conversationRef}
    >
      {turns.length === 0 ? (
        <div className="rounded-lg border border-border bg-background p-3.5">
          <p className="m-0 font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
            Chat
          </p>
          <p className="mt-2 mb-0 text-[13px] leading-relaxed text-muted-foreground">
            {file ? (
              <>
                Ask me to edit the document — e.g.{" "}
                <em>“change the date in section 4 to January 2024”</em>.
                I&apos;ll read it, make tracked changes, and they&apos;ll stream
                in on the right.
              </>
            ) : (
              "Drop a .docx on the right to begin."
            )}
          </p>
        </div>
      ) : null}

      {turns.map((turn, i) => (
        <TraceTurn
          key={i}
          turn={turn}
          onTogglePart={(id) => togglePart(i, id)}
        />
      ))}
    </div>
  );
}
