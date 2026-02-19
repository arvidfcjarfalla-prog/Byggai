"use client";

import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useState,
} from "react";
import Image from "next/image";
import {
  filesToMessageAttachments,
  getRequestConversation,
  markRequestConversationRead,
  sendRequestMessage,
  subscribeRequestMessages,
  type ConversationActorRole,
} from "../lib/request-messages";

interface RequestMessagesPanelProps {
  requestId: string;
  actorRole: ConversationActorRole;
  actorLabel: string;
  headline?: string;
  description?: string;
  onMessageSent?: () => void;
}

function formatDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString("sv-SE", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function RequestMessagesPanel({
  requestId,
  actorRole,
  actorLabel,
  headline = "Meddelanden",
  description = "Kommunicera direkt i tråden.",
  onMessageSent,
}: RequestMessagesPanelProps) {
  const [draft, setDraft] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [conversation, setConversation] = useState(() => getRequestConversation(requestId));

  useEffect(() => {
    const sync = () => setConversation(getRequestConversation(requestId));
    sync();
    return subscribeRequestMessages(sync);
  }, [requestId]);

  const unreadForActor = conversation.unreadByRole[actorRole] || 0;

  useEffect(() => {
    if (unreadForActor > 0) {
      markRequestConversationRead(requestId, actorRole);
    }
  }, [actorRole, requestId, unreadForActor]);

  const removeFile = useCallback((index: number) => {
    setFiles((current) => current.filter((_, i) => i !== index));
  }, []);

  const handleFileSelection = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    if (selected.length === 0) return;
    setFiles((current) => [...current, ...selected]);
    event.target.value = "";
  }, []);

  const handleSend = useCallback(async () => {
    setError(null);
    setNotice(null);

    if (draft.trim().length === 0 && files.length === 0) {
      setError("Skriv ett meddelande eller bifoga minst en fil.");
      return;
    }

    setIsSending(true);
    try {
      const { attachments, errors } = await filesToMessageAttachments(files);
      const message = sendRequestMessage({
        requestId,
        authorRole: actorRole,
        authorLabel: actorLabel,
        body: draft,
        messageType: "general",
        attachments,
      });

      if (errors.length > 0) {
        setNotice(`Meddelande skickat, men vissa bilagor hoppades över: ${errors.join(" ")}`);
      } else {
        setNotice("Meddelande skickat.");
      }

      setDraft("");
      setFiles([]);
      onMessageSent?.();
      void message;
    } catch (sendError) {
      const fallback = "Kunde inte skicka meddelandet just nu.";
      if (sendError instanceof Error && sendError.message.trim().length > 0) {
        setError(sendError.message);
      } else {
        setError(fallback);
      }
    } finally {
      setIsSending(false);
    }
  }, [actorLabel, actorRole, draft, files, onMessageSent, requestId]);

  return (
    <article className="rounded-3xl border border-[#E6DFD6] bg-white p-5 shadow-sm">
      <div>
        <h3 className="text-lg font-bold text-[#2A2520]">{headline}</h3>
        {description.trim().length > 0 && (
          <p className="mt-1 text-sm text-[#766B60]">{description}</p>
        )}
      </div>

      <div className="mt-4 h-[460px] space-y-3 overflow-y-auto rounded-2xl border border-[#E8E3DC] bg-[#FAF8F5] p-3">
        {conversation.messages.length === 0 && (
          <p className="rounded-xl border border-dashed border-[#D9D1C6] bg-white px-3 py-3 text-sm text-[#6B5A47]">
            Ingen kommunikation ännu. Skicka första meddelandet för att starta dialogen.
          </p>
        )}

        {conversation.messages.map((message) => {
          const fromActor = message.authorRole === actorRole;
          return (
            <div
              key={message.id}
              className={`flex ${fromActor ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[92%] rounded-2xl border px-3 py-2 shadow-sm ${
                  fromActor
                    ? "border-[#CDB49B] bg-[#F6F0E8]"
                    : "border-[#E8E3DC] bg-white"
                }`}
              >
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-[#2A2520]">{message.authorLabel}</span>
                  <span className="text-[10px] text-[#766B60]">{formatDate(message.createdAt)}</span>
                </div>

                {message.body && (
                  <p className="whitespace-pre-wrap text-sm text-[#2A2520]">{message.body}</p>
                )}

                {message.attachments.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {message.attachments.map((attachment) => (
                      <div
                        key={attachment.id}
                        className="rounded-xl border border-[#E8E3DC] bg-[#FAF8F5] p-2"
                      >
                        {attachment.kind === "image" ? (
                          <a
                            href={attachment.dataUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="block"
                            title="Öppna bild i ny flik"
                          >
                            <Image
                              src={attachment.dataUrl}
                              alt={attachment.name}
                              width={720}
                              height={220}
                              unoptimized
                              className="h-28 w-full rounded-lg object-cover"
                            />
                            <p className="mt-1 text-xs font-semibold text-[#2A2520]">
                              {attachment.name}
                            </p>
                          </a>
                        ) : (
                          <a
                            href={attachment.dataUrl}
                            download={attachment.name}
                            className="flex items-center justify-between gap-2 rounded-lg border border-[#D9D1C6] bg-white px-2 py-1.5 text-xs font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
                            title="Ladda ner bilaga"
                          >
                            <span className="truncate">{attachment.name}</span>
                            <span>{attachment.sizeKb.toFixed(1)} KB</span>
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 space-y-3 rounded-2xl border border-[#E8E3DC] bg-[#FAF8F5] p-3">
        <label className="block text-xs font-semibold text-[#6B5A47]">
          Skriv meddelande
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={4}
            placeholder="Skriv här..."
            className="mt-1 w-full rounded-xl border border-[#D9D1C6] bg-white px-3 py-2 text-sm text-[#2A2520]"
          />
        </label>

        <label className="inline-flex cursor-pointer items-center rounded-xl border border-[#D9D1C6] bg-white px-3 py-2 text-xs font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]">
          Bifoga filer
          <input
            type="file"
            multiple
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
            onChange={handleFileSelection}
            className="sr-only"
          />
          <span className="ml-2 text-[#8C7860]">{files.length > 0 ? `${files.length} valda` : "valfritt"}</span>
        </label>

        {files.length > 0 && (
          <div className="rounded-xl border border-[#E8E3DC] bg-white p-2">
            <ul className="space-y-1">
              {files.map((file, index) => (
                <li
                  key={`${file.name}-${file.lastModified}-${index}`}
                  className="flex items-center justify-between gap-2 rounded-lg border border-[#EFE8DD] bg-[#FAF8F5] px-2 py-1 text-xs"
                >
                  <span className="min-w-0 truncate text-[#2A2520]">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="rounded-md border border-[#D9D1C6] px-2 py-0.5 font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
                  >
                    Ta bort
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSend}
            disabled={isSending}
            className="rounded-xl bg-[#8C7860] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#6B5A47] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSending ? "Skickar..." : "Skicka meddelande"}
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded-xl border border-[#F0E3D0] bg-[#FFF9F1] px-3 py-2 text-sm text-[#6B5A47]">
          {error}
        </p>
      )}
      {notice && (
        <p className="mt-3 rounded-xl border border-[#CFE0F0] bg-[#EAF3FB] px-3 py-2 text-sm text-[#314A60]">
          {notice}
        </p>
      )}
    </article>
  );
}
