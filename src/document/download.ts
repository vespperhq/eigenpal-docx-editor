import type { DocxEditorInstance } from "@docx-editor.dev/core/editor";

export async function downloadDocx(
  editor: DocxEditorInstance,
  fileName: string
): Promise<void> {
  const buffer = await editor.save();
  const url = URL.createObjectURL(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    })
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
