export async function downloadPngBlobWithPicker(
  blob: Blob,
  defaultFilename: string,
): Promise<void> {
  if (typeof window !== "undefined" && "showSaveFilePicker" in window) {
    try {
      const handle = await (window as unknown as {
        showSaveFilePicker: (options: {
          suggestedName?: string;
          types?: Array<{
            description: string;
            accept: Record<string, string[]>;
          }>;
        }) => Promise<{
          createWritable: () => Promise<{
            write: (data: Blob) => Promise<void>;
            close: () => Promise<void>;
          }>;
        }>;
      }).showSaveFilePicker({
        suggestedName: defaultFilename,
        types: [
          {
            description: "PNG Image",
            accept: { "image/png": [".png"] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
    }
  }

  const url = URL.createObjectURL(blob);
  try {
    const anchor = createEl("a");
    anchor.href = url;
    anchor.download = defaultFilename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
}
