"use client";

import * as React from "react";
import { useRef, useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

// ----------------------------------------------------------------------
// Transition Physics
// ----------------------------------------------------------------------
const SPRING_TRANSITION =
  "max-width 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), height 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)";
const SMOOTH_HEIGHT_TRANSITION =
  "max-width 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), height 0.15s ease-out";

interface Attachment {
  id: string;
  file: File;
  url: string;
  name: string;
  width?: number;
  height?: number;
}

// ----------------------------------------------------------------------
// Sub-components
// ----------------------------------------------------------------------
function MorphingText({ text }: { text: string }) {
  const [width, setWidth] = useState<number | "auto">("auto");
  const spanRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (spanRef.current) setWidth(spanRef.current.offsetWidth);
  }, [text]);

  return (
    <span
      className="relative inline-flex items-center justify-center overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.175,0.885,0.32,1.275)]"
      style={{ width }}
    >
      <span ref={spanRef} className="invisible whitespace-nowrap px-1">
        {text}
      </span>
      <span
        key={text}
        className="absolute inset-0 flex items-center justify-center whitespace-nowrap animate-in fade-in zoom-in-95 duration-300"
      >
        {text}
      </span>
    </span>
  );
}

function ArrowUpIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M7 12V2M7 2L2.5 6.5M7 2L11.5 6.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <rect x="5" y="1" width="4" height="7" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M2.75 6.5V7a4.25 4.25 0 0 0 8.5 0v-.5M7 11.25V13"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" fill="currentColor" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M7 2.5V11.5M2.5 7H11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2.5 2.5L11.5 11.5M11.5 2.5L2.5 11.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function DynamicBarsIcon({ level }: { level: string }) {
  const isMediumOrHigh = level === "Medium" || level === "Max Effort";
  const isHigh = level === "Max Effort";
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <rect x="1.5" y="8" width="2.5" height="4.5" rx="1" fill="currentColor" opacity={1} />
      <rect
        x="5.75"
        y="5"
        width="2.5"
        height="7.5"
        rx="1"
        fill="currentColor"
        className="transition-opacity duration-300"
        opacity={isMediumOrHigh ? 1 : 0.3}
      />
      <rect
        x="10"
        y="2"
        width="2.5"
        height="10.5"
        rx="1"
        fill="currentColor"
        className="transition-opacity duration-300"
        opacity={isHigh ? 1 : 0.3}
      />
    </svg>
  );
}

function AttachmentThumb({
  attachment,
  index,
  onRemove,
}: {
  attachment: Attachment;
  index: number;
  onRemove: (id: string) => void;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ animationDelay: `${index * 35}ms`, animationFillMode: "backwards" }}
      className={cn(
        "group relative size-12 shrink-0 overflow-hidden rounded-xl border border-border bg-muted",
        "animate-in fade-in slide-in-from-top-3 zoom-in-90 duration-300",
      )}
    >
      <img src={attachment.url} alt={attachment.name} className="size-full object-cover" draggable={false} />
      <span
        className={cn(
          "absolute inset-0 flex items-start justify-end transition-colors duration-200",
          isHovered && "bg-black/25",
        )}
      >
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onRemove(attachment.id)}
          className={cn(
            "m-1 flex size-4 items-center justify-center rounded-full bg-background/90 text-foreground/70 shadow-sm transition-all duration-200 hover:bg-background hover:text-foreground hover:scale-110",
            isHovered ? "opacity-100 scale-100" : "opacity-0 scale-50 pointer-events-none",
          )}
          aria-label={`Remove ${attachment.name}`}
        >
          <CloseIcon />
        </button>
      </span>
    </div>
  );
}

// ----------------------------------------------------------------------
// Main Component
// ----------------------------------------------------------------------
export interface PromptInputProps {
  onSubmit?: (value: string, meta: { model: string; effort: string; attachments: File[] }) => void;
  onStop?: () => void;
  isStreaming?: boolean;
  placeholder?: string;
  className?: string;
  models?: string[];
  efforts?: string[];
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  maxAttachments?: number;
  autoFocus?: boolean;
}

export const PromptInput = React.forwardRef<HTMLDivElement, PromptInputProps>(function PromptInput(
  {
    onSubmit,
    onStop,
    isStreaming = false,
    placeholder = "Ask anything about a stock, index or filing",
    className,
    models = ["Balanced", "Deep Research", "Quick Take"],
    efforts = ["Low", "Medium", "Max Effort"],
    defaultValue = "",
    value: controlledValue,
    onChange,
    maxAttachments = 6,
    autoFocus = false,
  },
  ref,
) {
  const [expanded, setExpanded] = useState(false);
  const [isSmoothResize, setIsSmoothResize] = useState(false);
  const [localValue, setLocalValue] = useState(defaultValue);
  const [selectedModel, setSelectedModel] = useState(models[0] ?? "Balanced");
  const [effortIndex, setEffortIndex] = useState(1);
  const [isModelSelectOpen, setIsModelSelectOpen] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [audioData, setAudioData] = useState<number[]>(new Array(5).fill(0));
  const [textareaHeight, setTextareaHeight] = useState(24);

  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : localValue;
  const hasValue = value.trim() !== "" || attachments.length > 0;
  const effort = efforts[effortIndex] ?? "Medium";

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const valueRef = useRef(value);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    if (autoFocus) textareaRef.current?.focus();
  }, [autoFocus]);

  const handleValueChange = useCallback(
    (val: string) => {
      setIsSmoothResize(true);
      if (!isControlled) setLocalValue(val);
      onChange?.(val);
    },
    [isControlled, onChange],
  );

  // Auto-resize the textarea between one line and a scrollable max.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    const next = Math.min(Math.max(el.scrollHeight, 24), 160);
    el.style.height = `${next}px`;
    setTextareaHeight(next);
  }, [value, expanded]);

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void audioContextRef.current?.close();
    audioContextRef.current = null;
    setIsRecording(false);
    setAudioData(new Array(5).fill(0));
  }, []);

  useEffect(() => () => stopRecording(), [stopRecording]);

  const startRecording = useCallback(async () => {
    setIsSmoothResize(false);
    setExpanded(true);

    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return;
    }
    setIsRecording(true);
    streamRef.current = stream;

    const AudioCtx =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const audioCtx = new AudioCtx();
    audioContextRef.current = audioCtx;
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 64;
    audioCtx.createMediaStreamSource(stream).connect(analyser);
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      analyser.getByteFrequencyData(dataArray);
      const step = Math.floor(dataArray.length / 5);
      const bands = new Array(5).fill(0).map((_, i) => {
        let sum = 0;
        for (let j = 0; j < step; j++) sum += dataArray[i * step + j] ?? 0;
        return sum / step / 255;
      });
      setAudioData(bands);
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();

    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: new () => never }).SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: new () => never }).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new (SpeechRecognition as unknown as new () => {
      continuous: boolean;
      interimResults: boolean;
      start: () => void;
      stop: () => void;
      onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
      onerror: (() => void) | null;
      onend: (() => void) | null;
    })();
    recognition.continuous = true;
    recognition.interimResults = true;
    let baseline = valueRef.current;

    recognition.onresult = (event) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        if (!res) continue;
        const text = res[0]?.transcript ?? "";
        if (res.isFinal) final += text;
        else interim += text;
      }
      if (final) baseline += (baseline ? " " : "") + final;
      handleValueChange((baseline + (interim ? ` ${interim}` : "")).trim());
    };
    recognition.onerror = () => stopRecording();
    recognition.onend = () => stopRecording();
    recognitionRef.current = recognition;
    recognition.start();
  }, [handleValueChange, stopRecording]);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const next: Attachment[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      next.push({
        id: `${file.name}-${Date.now()}-${Math.random()}`,
        file,
        url: URL.createObjectURL(file),
        name: file.name,
      });
    }
    setIsSmoothResize(false);
    setAttachments((prev) => [...prev, ...next].slice(0, maxAttachments));
  };

  const submit = () => {
    if (!hasValue || isStreaming) return;
    onSubmit?.(value.trim(), {
      model: selectedModel,
      effort,
      attachments: attachments.map((a) => a.file),
    });
    if (!isControlled) setLocalValue("");
    onChange?.("");
    setAttachments([]);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  return (
    <div
      ref={ref}
      className={cn("w-full", className)}
      onClick={() => {
        setIsSmoothResize(false);
        setExpanded(true);
        textareaRef.current?.focus();
      }}
    >
      <div
        style={{ transition: isSmoothResize ? SMOOTH_HEIGHT_TRANSITION : SPRING_TRANSITION }}
        className={cn(
          "relative mx-auto w-full rounded-[26px] border border-border bg-card/80 p-2 shadow-[0_18px_50px_-24px_rgb(0_0_0/0.9)] backdrop-blur-xl",
          "focus-within:border-primary/50",
        )}
      >
        {attachments.length > 0 && (
          <div className="mb-2 flex gap-2 overflow-x-auto px-1 pt-1 no-scrollbar">
            {attachments.map((a, i) => (
              <AttachmentThumb
                key={a.id}
                attachment={a}
                index={i}
                onRemove={(id) => setAttachments((prev) => prev.filter((p) => p.id !== id))}
              />
            ))}
          </div>
        )}

        <div className="px-2 pt-1.5">
          <textarea
            ref={textareaRef}
            value={value}
            rows={1}
            onChange={(e) => handleValueChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={isRecording ? "Listening…" : placeholder}
            style={{ height: textareaHeight }}
            className="w-full resize-none bg-transparent text-[15px] leading-6 text-foreground outline-none placeholder:text-muted-foreground/70"
          />
        </div>

        <div className="mt-1 flex items-center gap-1.5 px-1">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            className="flex size-8 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Attach image"
          >
            <PlusIcon />
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsModelSelectOpen((o) => !o);
              }}
              className="flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <MorphingText text={selectedModel} />
            </button>
            {isModelSelectOpen && (
              <div className="absolute bottom-10 left-0 z-30 w-44 overflow-hidden rounded-xl border border-border bg-popover p-1 shadow-xl animate-in fade-in zoom-in-95 duration-150">
                {models.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedModel(m);
                      setIsModelSelectOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center rounded-lg px-3 py-2 text-left text-xs transition-colors hover:bg-accent",
                      m === selectedModel ? "text-primary" : "text-popover-foreground",
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setEffortIndex((i) => (i + 1) % efforts.length);
            }}
            className="flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <DynamicBarsIcon level={effort} />
            <MorphingText text={effort} />
          </button>

          <div className="ml-auto flex items-center gap-1.5">
            {isRecording && (
              <div className="flex items-end gap-0.5 pr-1">
                {audioData.map((level, i) => (
                  <span
                    key={i}
                    className="w-0.5 rounded-full bg-primary transition-all duration-75"
                    style={{ height: `${6 + level * 18}px` }}
                  />
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (isRecording) stopRecording();
                else void startRecording();
              }}
              className={cn(
                "flex size-8 items-center justify-center rounded-full border border-border transition-colors",
                isRecording
                  ? "border-primary/60 bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
              aria-label={isRecording ? "Stop recording" : "Start voice input"}
            >
              <MicIcon />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (isStreaming) onStop?.();
                else submit();
              }}
              disabled={!isStreaming && !hasValue}
              className={cn(
                "flex size-8 items-center justify-center rounded-full transition-all duration-200",
                isStreaming || hasValue
                  ? "bg-primary text-primary-foreground hover:opacity-90"
                  : "bg-muted text-muted-foreground/50",
              )}
              aria-label={isStreaming ? "Stop" : "Send"}
            >
              {isStreaming ? <StopIcon /> : <ArrowUpIcon />}
            </button>
          </div>
        </div>
      </div>
      {expanded ? null : null}
    </div>
  );
});
