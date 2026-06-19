import React from "react";

export const AmbientAuraBackground = () => {
  return (
    <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden" aria-hidden="true">
      {/* Dynamic Animated Mesh Auras */}
      <div className="absolute inset-0 z-0">
        
        {/* Blob 1 - Indigo Aura */}
        <div className="absolute top-[-10%] left-[-10%] w-[45rem] h-[45rem] rounded-full blur-[140px] bg-indigo-650/15 dark:bg-indigo-500/8 animate-aura-1" />
        
        {/* Blob 2 - Purple Aura */}
        <div className="absolute bottom-[10%] right-[-10%] w-[40rem] h-[40rem] rounded-full blur-[140px] bg-purple-600/12 dark:bg-purple-500/8 animate-aura-2" />
        
        {/* Blob 3 - Cyan Aurora POP */}
        <div className="absolute top-[25%] left-[30%] w-[35rem] h-[35rem] rounded-full blur-[120px] bg-cyan-500/12 dark:bg-cyan-500/6 animate-aura-3" />

        {/* Blob 4 - Rose Aurora POP */}
        <div className="absolute bottom-[20%] left-[-5%] w-[38rem] h-[38rem] rounded-full blur-[130px] bg-rose-500/10 dark:bg-rose-500/5 animate-aura-1" />
        
      </div>

      {/* Cyber Grid Dot Overlay */}
      <div className="absolute inset-0 z-0 opacity-40 dark:opacity-20 subtle-grid-dots" />

      {/* Cinematic Vignette Overlay */}
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-zinc-950/10 via-transparent to-zinc-950/15 dark:from-black/40 dark:via-transparent dark:to-black/40 pointer-events-none" />
      <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_center,rgba(0,0,0,0)_40%,rgba(9,9,11,0.15)_80%)] dark:bg-[radial-gradient(circle_at_center,rgba(0,0,0,0)_30%,rgba(0,0,0,0.75)_90%)] pointer-events-none" />
    </div>
  );
};
