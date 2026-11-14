interface DraftHandler {
  flush: () => Promise<void>;
  isPending: () => boolean;
}

const handlers = new Set<DraftHandler>();

export function registerDraftHandler(handler: DraftHandler): () => void {
  handlers.add(handler);
  return () => handlers.delete(handler);
}

/** The native quit handler must await this before allowing the process to exit. */
export async function flushPendingDrafts(): Promise<void> {
  await Promise.all(Array.from(handlers, (handler) => handler.flush()));
}

export function hasPendingDrafts(): boolean {
  return Array.from(handlers).some((handler) => handler.isPending());
}

export function notifyDraftsChanged(): void {
  window.dispatchEvent(new Event('workbench:drafts-changed'));
}
