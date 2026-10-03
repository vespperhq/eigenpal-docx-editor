import { createContext, useContext, useState, type ReactNode } from "react";
import { useChatConversation } from "../hooks/useChatConversation";
import { useEditorSelection } from "../hooks/useEditorSelection";
import { useHealth } from "../hooks/useHealth";
import { useImageAttachments } from "../hooks/useImageAttachments";
import { useSuggestions } from "../hooks/useSuggestions";

export type OpenFile = { name: string; bytes: Uint8Array };

type ChatContextValue = {
  composer: {
    instruction: string;
    setInstruction: (value: string) => void;
    selectedContent: string;
    clearSelectedContent: () => void;
    images: ReturnType<typeof useImageAttachments>["images"];
    imageError: ReturnType<typeof useImageAttachments>["imageError"];
    imagesLoading: boolean;
    addPastedImages: (files: File[]) => Promise<void>;
    removeImage: (id: string) => void;
  };
  conversation: ReturnType<typeof useChatConversation>;
  suggestions: ReturnType<typeof useSuggestions> & {
    /** The server proposes edits as suggestions instead of applying them. */
    enabled: boolean;
  };
  models: {
    model: string;
    models: string[];
    modelsLoading: boolean;
    setModel: (model: string) => void;
  };
  document: {
    file: OpenFile | null;
    openFile: (file: File) => Promise<void>;
    /** The agent or an apply is replacing the document; local edits would be refused. */
    locked: boolean;
  };
};

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

type ChatProviderProps = {
  file: OpenFile | null;
  onFileChange: (file: OpenFile) => void;
  children: ReactNode;
};

// Must render inside `DocxEditor.Root`: its hooks read the editor from it.
export function ChatProvider({ file, onFileChange, children }: ChatProviderProps) {
  const [instruction, setInstruction] = useState("");
  const { selectedContent, clearSelectedContent } = useEditorSelection();
  const imageAttachments = useImageAttachments();
  const health = useHealth();
  const suggestions = useSuggestions();

  const conversation = useChatConversation({
    instruction,
    selectedContent,
    images: imageAttachments.images,
    imagesLoading: imageAttachments.imagesLoading,
    model: health.model,
    clearComposer: () => {
      setInstruction("");
      imageAttachments.clearImages();
    },
    applying: suggestions.applying,
    onSuggestionsProposed: suggestions.addSet,
    onSuggestionReady: suggestions.addSuggestion,
    getSuggestionReview: suggestions.getReview,
  });

  const locked = conversation.busy || suggestions.applying;

  async function openFile(next: File) {
    if (locked) return;
    const bytes = new Uint8Array(await next.arrayBuffer());
    conversation.reset();
    suggestions.reset();
    onFileChange({ name: next.name, bytes });
  }

  return (
    <ChatContext.Provider
      value={{
        composer: {
          instruction,
          setInstruction,
          selectedContent,
          clearSelectedContent,
          images: imageAttachments.images,
          imageError: imageAttachments.imageError,
          imagesLoading: imageAttachments.imagesLoading,
          addPastedImages: imageAttachments.addPastedImages,
          removeImage: imageAttachments.removeImage,
        },
        conversation,
        suggestions: { ...suggestions, enabled: health.suggestions },
        models: {
          model: health.model,
          models: health.models,
          modelsLoading: health.modelsLoading,
          setModel: health.setModel,
        },
        document: { file, openFile, locked },
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

function useChatContext(): ChatContextValue {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("Chat hooks must be used within ChatProvider");
  }
  return context;
}

export function useChatComposer() {
  return useChatContext().composer;
}

export function useConversation() {
  return useChatContext().conversation;
}

export function useChatSuggestions() {
  return useChatContext().suggestions;
}

export function useChatModels() {
  return useChatContext().models;
}

export function useDocument() {
  return useChatContext().document;
}
