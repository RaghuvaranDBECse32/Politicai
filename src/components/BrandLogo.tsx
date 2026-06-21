import React from "react";
import { Globe, Shield, Sparkles } from "lucide-react";

/**
 * High-fidelity, modern SVG icon representing Global Elections & Political Intelligence (PolitiChat)
 */
export function PolitiChatIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <radialGradient id="globeGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#2563eb" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#1e3a8a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
      </defs>

      {/* Subtle outer radiating wave representing information flows */}
      <circle cx="50" cy="50" r="45" stroke="rgba(59, 130, 246, 0.15)" strokeWidth="1" strokeDasharray="4 4" />
      <circle cx="50" cy="50" r="38" fill="url(#globeGlow)" />

      {/* Abstract overlapping curved lines representing meridians/global networks */}
      <path
        d="M 50 15 A 35 35 0 0 1 50 85"
        stroke="rgba(255, 255, 255, 0.25)"
        strokeWidth="1.5"
      />
      <path
        d="M 50 15 A 18 35 0 0 1 50 85"
        stroke="rgba(255, 255, 255, 0.45)"
        strokeWidth="1.5"
      />
      <path
        d="M 50 15 A 18 35 0 0 0 50 85"
        stroke="rgba(255, 255, 255, 0.45)"
        strokeWidth="1.5"
      />
      <path
        d="M 15 50 A 35 35 0 0 0 85 50"
        stroke="rgba(255, 255, 255, 0.25)"
        strokeWidth="1.5"
      />
      <path
        d="M 20 32 A 35 15 0 0 0 80 32"
        stroke="rgba(255, 255, 255, 0.25)"
        strokeWidth="1"
      />
      <path
        d="M 20 68 A 35 15 0 0 0 80 68"
        stroke="rgba(255, 255, 255, 0.25)"
        strokeWidth="1"
      />

      {/* Centered shield represent safety and source verification */}
      <path
        d="M 50 32 
           C 58 32, 64 30, 64 30
           L 64 54
           C 64 66, 50 74, 50 74
           C 50 74, 36 66, 36 54
           L 36 30
           C 36 30, 42 32, 50 32
           Z"
        fill="url(#shieldGrad)"
        stroke="#ffffff"
        strokeWidth="1.5"
        filter="drop-shadow(0px 2px 4px rgba(0,0,0,0.4))"
      />

      {/* Inside check/verify tick representing real vs fake news auditing */}
      <path
        d="M 44 54 L 48 58 L 56 48"
        stroke="#ffffff"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * 3D-feeling multifaceted Globe-Network Star for header accents & empty states
 */
export function PolitiChatWovenStar({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <div className={`${className} flex items-center justify-center relative`}>
      <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-[10px] animate-pulse" />
      <PolitiChatIcon className="w-full h-full relative z-10" />
    </div>
  );
}

/**
 * PolitiChat Main Branding Header
 */
export function PolitiChatLogoHeader({ className = "h-9" }: { className?: string }) {
  return (
    <div className="flex items-center gap-3">
      <PolitiChatWovenStar className="w-10 h-10 hover:rotate-12 transition-transform duration-300" />
      <div className="flex flex-col">
        <span className="font-sans font-extrabold text-lg tracking-tight text-white leading-none flex items-center gap-1.5">
          PolitiChat <span className="text-[10px] bg-blue-500 text-white font-mono px-1.5 py-0.5 rounded uppercase tracking-widest font-normal font-sans">GPT</span>
        </span>
        <span className="text-[8px] text-blue-400 tracking-wider font-extrabold uppercase leading-none mt-1.5">
          GLOBAL POLITICAL & ELECTION INTELLIGENCE
        </span>
      </div>
    </div>
  );
}
