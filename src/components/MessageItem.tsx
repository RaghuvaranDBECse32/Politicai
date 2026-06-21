import React, { useState } from "react";
import { Message } from "../types";
import { Copy, Check, Terminal, ShieldAlert, Sparkles, Globe } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Prism from "prismjs";

// Load tomorrow theme for code snippet highlight
import "prismjs/themes/prism-tomorrow.css";

// Pre-load common language components for high-quality syntax rendering
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-json";
import "prismjs/components/prism-markdown";
import "prismjs/components/prism-python";
import "prismjs/components/prism-css";

interface MessageItemProps {
  message: Message;
}

export const MessageItem: React.FC<MessageItemProps> = ({ message }) => {
  const [copied, setCopied] = useState(false);
  const isModel = message.role === "model";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Clipboard copy failed:", err);
    }
  };

  return (
    <div
      className={`flex w-full mb-6 py-4 px-5 rounded-2xl border transition-all duration-300 ${
        isModel ? "ai-bubble border-white/10" : "user-bubble border-blue-500/20"
      }`}
    >
      <div className="flex gap-4 w-full items-start">
        {/* Avatar section */}
        <div className="flex-shrink-0">
          {isModel ? (
            <div className="w-9 h-9 rounded-xl bg-blue-600/10 border border-blue-500/30 flex items-center justify-center text-blue-400 font-display font-bold text-sm shadow-inner animate-pulse">
              <Sparkles className="w-5 h-5 text-blue-400" />
            </div>
          ) : (
            <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-mono font-bold text-xs uppercase">
              U
            </div>
          )}
        </div>

        {/* Contents area */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 tracking-wider flex items-center gap-1.5 uppercase font-mono">
              {isModel ? (
                <>
                  <Globe className="w-3.5 h-3.5 text-blue-400" />
                  PolitiChat Intelligence
                </>
              ) : (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
                  Varying Safety Analyst
                </>
              )}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500 font-mono">{message.timestamp}</span>
              <button
                id={`btn-copy-${message.id}`}
                onClick={handleCopy}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-transparent hover:border-slate-700/50 transition-all cursor-pointer"
                title="Copy text content"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="markdown-body transition-all duration-150">
            {message.content ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ node, className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || "");
                    const lang = match ? match[1] : "";
                    const isInline = !className;

                    if (!isInline && lang) {
                      let highlighted = String(children).replace(/\n$/, "");
                      try {
                        if (Prism.languages[lang]) {
                          highlighted = Prism.highlight(highlighted, Prism.languages[lang], lang);
                        }
                      } catch (e) {
                        console.error("Prism high-lighting failure:", e);
                      }
                      return (
                        <pre className={`language-${lang} p-4 rounded-xl bg-slate-950 border border-white/5 overflow-x-auto text-[11px] font-mono my-3 shadow-inner relative group`}>
                          <div className="absolute top-2 right-2 text-[9px] text-slate-500 font-mono select-none uppercase tracking-wider bg-white/5 px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                            {lang}
                          </div>
                          <code dangerouslySetInnerHTML={{ __html: highlighted }} />
                        </pre>
                      );
                    }
                    return (
                      <code className="text-[11px] bg-white/10 px-1.5 py-0.5 rounded font-mono border border-white/5 text-amber-300" {...props}>
                        {children}
                      </code>
                    );
                  }
                }}
              >
                {message.content}
              </ReactMarkdown>
            ) : (
              <div className="flex items-center gap-2 py-2 text-slate-400 font-mono text-xs">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping"></div>
                Streaming intelligence chunks...
              </div>
            )}
          </div>

          {/* Grounding/Search Citations */}
          {isModel && message.groundingSources && message.groundingSources.length > 0 && (
            <div className="mt-4 pt-3 border-t border-white/5 space-y-2">
              <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-blue-400 uppercase tracking-wider">
                <Globe className="w-3.5 h-3.5 text-blue-400" />
                Verified Sources via Live Google Search Grounding:
              </div>
              <div className="flex flex-wrap gap-2">
                {message.groundingSources.map((source, index) => (
                  <a
                    key={index}
                    href={source.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-blue-500/5 hover:bg-blue-500/15 border border-blue-500/10 hover:border-blue-500/30 text-blue-300 transition-all cursor-pointer font-sans"
                    title={source.uri}
                  >
                    <span className="w-4 h-4 rounded bg-blue-500/10 text-blue-400 font-mono text-[10px] flex items-center justify-center font-bold">
                      {index + 1}
                    </span>
                    <span className="truncate max-w-[200px] font-medium">{source.title || "Web Reference"}</span>
                    <svg className="w-3 h-3 opacity-60 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
