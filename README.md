# Insightful Search

Can you create a same ui like a perplexity finance or a Google finance search on the Internet take the images in create the same UID design with every component and every page.  https://Sanyam400-screener.hf.space/mcp, then take this MCP for getting the all the data you need to get into the app, and add your API key for the AI analysis and make the chat input area like this block :- Build this as my initial prototype



Copy-paste this component to /components/ui folder:

```tsx

ai-chat-input.tsx

"use client";



import * as React from "react";

import { useRef, useState, useEffect, useCallback } from "react";

import { cn } from "@/lib/utils";



// ----------------------------------------------------------------------

// Transition Physics

// ----------------------------------------------------------------------

const SPRING_TRANSITION = "max-width 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), height 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)";

const SMOOTH_HEIGHT_TRANSITION = "max-width 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), height 0.15s ease-out";



// ----------------------------------------------------------------------

// Types

// ----------------------------------------------------------------------

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

    if (spanRef.current) {

      setWidth(spanRef.current.offsetWidth);

    }

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



function ModelIcon({ model, className }: { model: string; className?: string }) {

  const icons: Record<string, string> = {

    "Composer 2.5": "https://res.cloudinary.com/drhx7imeb/image/upload/v1781695268/cursor-ai-code-icon_j4vnux.svg",

    "Gemini 3.5 Flash": "https://res.cloudinary.com/drhx7imeb/image/upload/v1781695268/google-gemini-icon_l6kk5q.svg",

    "GPT 5.5": "https://res.cloudinary.com/drhx7imeb/image/upload/v1781695269/openai-icon_zozuib.svg",

    "Opus 4.8": "https://res.cloudinary.com/drhx7imeb/image/upload/v1781695268/Claude_AI_symbol_yqfzlc.svg",

    "GLM 5.2": "https://res.cloudinary.com/drhx7imeb/image/upload/v1781695269/z-ai-icon_xi4xvo.svg"

  };



  const filters: Record<string, string> = {

    "GPT 5.5": "dark:invert", 

  };



  return (

    <img 

      src={icons[model] || icons["GPT 5.5"]} 

      alt={model} 

      className={cn("object-contain", filters[model], className)} 

    />

  );

}



function ArrowUpIcon() {

  return (

    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">

      <path d="M7 12V2M7 2L2.5 6.5M7 2L11.5 6.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />

    </svg>

  );

}



function MicIcon() {

  return (

    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">

      <rect x="5" y="1" width="4" height="7" rx="2" stroke="currentColor" strokeWidth="1.5" />

      <path d="M2.75 6.5V7a4.25 4.25 0 0 0 8.5 0v-.5M7 11.25V13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />

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

      <rect x="1.5" y="8" width="2.5" height="4.5" rx="1" fill="currentColor" className="transition-opacity duration-300" opacity={1} />

      <rect x="5.75" y="5" width="2.5" height="7.5" rx="1" fill="currentColor" className="transition-opacity duration-300" opacity={isMediumOrHigh ? 1 : 0.3} />

      <rect x="10" y="2" width="2.5" height="10.5" rx="1" fill="currentColor" className="transition-opacity duration-300" opacity={isHigh ? 1 : 0.3} />

    </svg>

  );

}



// ----------------------------------------------------------------------

// Attachment Thumbnail

// ----------------------------------------------------------------------

function AttachmentThumb({

  attachment,

  index,

  onRemove,

  onOpen,

  registerRef,

}: {

  attachment: Attachment;

  index: number;

  onRemove: (id: string) => void;

  onOpen: (attachment: Attachment, rect: DOMRect) => void;

  registerRef: (id: string, el: HTMLButtonElement | null) => void;

}) {

  const [isHovered, setIsHovered] = useState(false);

  const btnRef = useRef<HTMLButtonElement>(null);



  return (

    <button

      ref={(el) => {

        btnRef.current = el;

        registerRef(attachment.id, el);

      }}

      type="button"

      onMouseDown={(e) => e.preventDefault()}

      onMouseEnter={() => setIsHovered(true)}

      onMouseLeave={() => setIsHovered(false)}

      onClick={(e) => {

        e.stopPropagation();

        if (btnRef.current) {

          onOpen(attachment, btnRef.current.getBoundingClientRect());

        }

      }}

      style={{ animationDelay: `${index * 35}ms`, animationFillMode: "backwards" }}

      className={cn(

        "group relative size-12 shrink-0 overflow-hidden rounded-xl border border-border bg-muted outline-none",

        "transition-transform duration-200 ease-[cubic-bezier(0.175,0.885,0.32,1.275)] hover:scale-[1.04] active:scale-[0.96]",

        "animate-in fade-in slide-in-from-top-3 zoom-in-90 duration-400"

      )}

      aria-label={`Open preview of ${attachment.name}`}

    >

      <img src={attachment.url} alt={attachment.name} className="size-full object-cover" draggable={false} />

      <span className={cn("absolute inset-0 flex items-start justify-end bg-black/0 transition-colors duration-200", isHovered && "bg-black/25")}>

        <span

          role="button" tabIndex={-1}

          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}

          onClick={(e) => { e.stopPropagation(); onRemove(attachment.id); }}

          className={cn(

            "m-1 flex size-4 items-center justify-center rounded-full bg-background/90 text-foreground/70 shadow-sm transition-all duration-200 ease-[cubic-bezier(0.175,0.885,0.32,1.275)] hover:bg-background hover:text-foreground hover:scale-110",

            isHovered ? "opacity-100 scale-100" : "opacity-0 scale-50 pointer-events-none"

          )}

          aria-label={`Remove ${attachment.name}`}

        >

          <CloseIcon />

        </span>

      </span>

    </button>

  );

}



// ----------------------------------------------------------------------

// Shared-Element Gallery Modal

// ----------------------------------------------------------------------

function AttachmentGalleryModal({

  attachment,

  originRect,

  onClose,

}: {

  attachment: Attachment;

  originRect: DOMRect;

  onClose: () => void;

}) {

  const [phase, setPhase] = useState<"opening" | "open" | "closing">("opening");

  const [targetRect, setTargetRect] = useState<{

    top: number;

    left: number;

    width: number;

    height: number;

    radius: number;

  } | null>(null);

  const imgRef = useRef<HTMLImageElement>(null);



  useEffect(() => {

    const maxW = Math.min(window.innerWidth * 0.86, 560);

    const maxH = Math.min(window.innerHeight * 0.78, 720);



    const naturalW = attachment.width || 800;

    const naturalH = attachment.height || 600;

    const scale = Math.min(maxW / naturalW, maxH / naturalH, 1.6);



    const width = naturalW * scale;

    const height = naturalH * scale;



    setTargetRect({

      top: (window.innerHeight - height) / 2,

      left: (window.innerWidth - width) / 2,

      width,

      height,

      radius: 20,

    });



    const raf = requestAnimationFrame(() => setPhase("open"));

    return () => cancelAnimationFrame(raf);

  }, [attachment]);



  const handleClose = useCallback(() => setPhase("closing"), []);



  useEffect(() => {

    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };

    document.addEventListener("keydown", onKey);

    return () => document.removeEventListener("keydown", onKey);

  }, [handleClose]);



  const isOpen = phase === "open";

  const isClosing = phase === "closing";



  const geometry = isOpen && targetRect

      ? targetRect

      : { top: originRect.top, left: originRect.left, width: originRect.width, height: originRect.height, radius: 12 };



  const animEasing = isClosing ? "ease-out" : "cubic-bezier(0.175, 0.885, 0.32, 1.275)";

  const animDur = isClosing ? "0.3s" : "0.45s";

  const flipTransition = `top ${animDur} ${animEasing}, left ${animDur} ${animEasing}, width ${animDur} ${animEasing}, height ${animDur} ${animEasing}, border-radius ${animDur} ${animEasing}`;



  return (

    <div className="fixed inset-0 z-[100]" onClick={handleClose} role="dialog" aria-modal="true">

      <div className="absolute inset-0 bg-background/70 backdrop-blur-md transition-opacity duration-400" style={{ opacity: isOpen ? 1 : 0 }} />

      <div

        style={{

          position: "fixed",

          top: geometry.top, left: geometry.left, width: geometry.width, height: geometry.height,

          borderRadius: geometry.radius, transition: flipTransition, overflow: "hidden",

          boxShadow: isOpen ? "0 24px 60px -12px rgb(0 0 0 / 0.35)" : "0 0px 0px 0px rgb(0 0 0 / 0)",

        }}

        className="bg-muted"

        onTransitionEnd={() => { if (phase === "closing") onClose(); }}

        onClick={(e) => e.stopPropagation()}

      >

        <img ref={imgRef} src={attachment.url} alt={attachment.name} className="size-full object-cover" draggable={false} />

      </div>



      <button

        type="button" onClick={handleClose}

        style={{ opacity: isOpen ? 1 : 0, transform: isOpen ? "scale(1)" : "scale(0.7)" }}

        className={cn(

          "fixed right-4 top-4 flex size-9 items-center justify-center rounded-full bg-card/90 text-foreground/70 shadow-md backdrop-blur-sm",

          "transition-all duration-300 ease-[cubic-bezier(0.175,0.885,0.32,1.275)] hover:bg-card hover:text-foreground",

          !isOpen && "pointer-events-none"

        )}

      >

        <span className="scale-150"><CloseIcon /></span>

      </button>

    </div>

  );

}



// ----------------------------------------------------------------------

// Main Component

// ----------------------------------------------------------------------



export interface PromptInputProps {

  onSubmit?: (

    value: string,

    meta: { model: string; effort: string; attachments: File[] }

  ) => void;

  placeholder?: string;

  className?: string;

  models?: string[];

  efforts?: string[];

  defaultValue?: string;

  value?: string;

  onChange?: (value: string) => void;

  maxAttachments?: number;

}



export const PromptInput = React.forwardRef<HTMLDivElement, PromptInputProps>(

  (

    {

      onSubmit,

      placeholder = "Ask anything",

      className,

      models = ["GPT 5.5", "Opus 4.8", "Gemini 3.5 Flash", "Composer 2.5", "GLM 5.2"],

      efforts = ["Low", "Medium", "Max Effort"],

      defaultValue = "",

      value: controlledValue,

      onChange,

      maxAttachments = 6,

    },

    ref

  ) => {

    const [expanded, setExpanded] = useState(false);

    const [isSmoothResize, setIsSmoothResize] = useState(false);

    const [localValue, setLocalValue] = useState(defaultValue);

    const [selectedModel, setSelectedModel] = useState(models[0]);

    const [effortIndex, setEffortIndex] = useState(1);

    const [isModelSelectOpen, setIsModelSelectOpen] = useState(false);



    const [attachments, setAttachments] = useState<Attachment[]>([]);

    const [activeAttachment, setActiveAttachment] = useState<{ attachment: Attachment; rect: DOMRect } | null>(null);



    // Audio/Voice recording states

    const [isRecording, setIsRecording] = useState(false);

    const [audioData, setAudioData] = useState<number[]>(new Array(5).fill(0));

    const valueRef = useRef(controlledValue !== undefined ? controlledValue : localValue);



    // Refs for Web Audio & Speech Recognition cleanup

    const streamRef = useRef<MediaStream | null>(null);

    const audioContextRef = useRef<AudioContext | null>(null);

    const rafRef = useRef<number | null>(null);

    const recognitionRef = useRef<any>(null);

    const demoIntervalRef = useRef<number | null>(null);

    const demoTextIntervalRef = useRef<number | null>(null);



    const [hoverStyle, setHoverStyle] = useState({ opacity: 0, transform: "translateY(0px) scale(0.95)", transition: "none" });

    const [containerHeight, setContainerHeight] = useState(116);

    const [textareaHeight, setTextareaHeight] = useState(68);

    const [isScrolling, setIsScrolling] = useState(false);



    const isControlled = controlledValue !== undefined;

    const value = isControlled ? controlledValue : localValue;

    const hasValue = value.trim() !== "" || attachments.length > 0;

    const hasAttachments = attachments.length > 0;



    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const internalContainerRef = useRef<HTMLDivElement>(null);

    const topFadeRef = useRef<HTMLDivElement>(null);

    const bottomFadeRef = useRef<HTMLDivElement>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const thumbRefs = useRef<Map<string, HTMLButtonElement | null>>(new Map());



    // Sync value ref for audio callback closure

    useEffect(() => {

      valueRef.current = value;

    }, [value]);



    const updateFades = () => {

      const el = textareaRef.current;

      if (!el) return;

      const { scrollTop, scrollHeight, clientHeight } = el;

      if (topFadeRef.current) {

        topFadeRef.current.style.opacity = Math.min(scrollTop / 20, 1).toString();

      }

      if (bottomFadeRef.current) {

        const bottomScroll = scrollHeight - clientHeight - scrollTop;

        bottomFadeRef.current.style.opacity = Math.min(Math.max(bottomScroll - 16, 0) / 10, 1).toString();

      }

    };



    const handleValueChange = useCallback((val: string) => {

      setIsSmoothResize(true); 

      if (!isControlled) setLocalValue(val);

      onChange?.(val);

    }, [isControlled, onChange]);



    const expand = () => {

      setIsSmoothResize(false); 

      setExpanded(true);

    };



    // --- Voice Recording Logic ---

    const stopRecording = useCallback(() => {

      if (recognitionRef.current) {

        recognitionRef.current.stop();

        recognitionRef.current = null;

      }

      if (rafRef.current) {

        cancelAnimationFrame(rafRef.current);

        rafRef.current = null;

      }

      if (streamRef.current) {

        streamRef.current.getTracks().forEach((track) => track.stop());

        streamRef.current = null;

      }

      if (audioContextRef.current) {

        audioContextRef.current.close();

        audioContextRef.current = null;

      }

      if (demoIntervalRef.current) {

        window.clearInterval(demoIntervalRef.current);

        demoIntervalRef.current = null;

      }

      if (demoTextIntervalRef.current) {

        window.clearInterval(demoTextIntervalRef.current);

        demoTextIntervalRef.current = null;

      }

      setIsRecording(false);

      setAudioData(new Array(5).fill(0));

    }, []);



    const startRecording = useCallback(async () => {

      setIsSmoothResize(false);

      setExpanded(true);



      let stream: MediaStream | null = null;

      try {

        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {

          stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        }

      } catch (err) {

        console.warn("Microphone access denied or unavailable. Falling back to simulated voice mode for demo.");

      }



      setIsRecording(true);



      // Simulation function for tight sandbox environments

      function simulateText() {

        const fakeText = "Can you build a high fidelity Framer Motion layout animation for a dark mode dashboard?";

        const words = fakeText.split(" ");

        let i = 0;

        let currentBase = valueRef.current;

        demoTextIntervalRef.current = window.setInterval(() => {

          if (i < words.length) {

            currentBase = (currentBase ? currentBase + " " : "") + words[i];

            handleValueChange(currentBase);

            i++;

          } else {

            stopRecording();

          }

        }, 300);

      }



      if (stream) {

        streamRef.current = stream;

        

        // Setup Web Audio API for visualizer

        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;

        const audioCtx = new AudioCtx();

        audioContextRef.current = audioCtx;



        const analyser = audioCtx.createAnalyser();

        analyser.fftSize = 64; 

        const source = audioCtx.createMediaStreamSource(stream);

        source.connect(analyser);



        const dataArray = new Uint8Array(analyser.frequencyBinCount);



        const updateVisualizer = () => {

          analyser.getByteFrequencyData(dataArray);

          const bands = new Array(5).fill(0);

          const step = Math.floor(dataArray.length / 5);

          for (let i = 0; i < 5; i++) {

            let sum = 0;

            for (let j = 0; j < step; j++) {

              sum += dataArray[i * step + j];

            }

            bands[i] = sum / step / 255; // normalize to 0-1

          }

          setAudioData(bands);

          rafRef.current = requestAnimationFrame(updateVisualizer);

        };

        updateVisualizer();



        // Setup Speech Recognition

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

        if (SpeechRecognition) {

          const recognition = new SpeechRecognition();

          recognition.continuous = true;

          recognition.interimResults = true;



          let baseline = valueRef.current;



          recognition.onresult = (event: any) => {

            let interimTranscript = "";

            let finalTranscript = "";



            for (let i = event.resultIndex; i < event.results.length; ++i) {

              if (event.results[i].isFinal) {

                finalTranscript += event.results[i][0].transcript;

              } else {

                interimTranscript += event.results[i][0].transcript;

              }

            }

            

            if (finalTranscript) {

               baseline += (baseline ? " " : "") + finalTranscript;

            }

            

            handleValueChange((baseline + (interimTranscript ? " " + interimTranscript : "")).trim());

          };



          recognition.onerror = (e: any) => {

            console.error("Speech recognition error", e);

            stopRecording();

          };



          recognition.onend = () => {

             stopRecording();

          };



          recognitionRef.current = recognition;

          recognition.start();

        } else {

          console.warn("Speech Recognition API not supported in this browser. Using simulated text.");

          simulateText();

        }

      } else {

        // Fallback simulated visualizer

        demoIntervalRef.current = window.setInterval(() => {

          setAudioData(Arr

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/b270efe8-a96f-4b0e-8ba0-edb9ab44c7c4).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
