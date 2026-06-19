import React from "react";

interface ManagementPlaceholderPageProps {
  title: string;
  description: string;
}

export function ManagementPlaceholderPage({ title, description }: ManagementPlaceholderPageProps) {
  return (
    <div className="flex-1 p-8 lg:p-10 transition-colors duration-300">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl lg:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-900 via-indigo-800 to-slate-600 dark:from-white dark:via-indigo-100 dark:to-gray-400 tracking-tight mb-4 transition-all duration-300">
          {title}
        </h1>
        <p className="text-slate-500 dark:text-gray-400 text-lg mb-8 font-medium transition-colors duration-300">
          {description}
        </p>
        
        <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-gray-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center backdrop-blur-xl shadow-sm dark:shadow-none transition-all duration-300">
          <div className="w-20 h-20 bg-slate-100 dark:bg-gray-800/50 rounded-full flex items-center justify-center mb-6 shadow-inner dark:shadow-none">
            <svg className="w-10 h-10 text-slate-400 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3 tracking-tight">Module Under Construction</h2>
          <p className="text-slate-500 dark:text-gray-500 max-w-md font-medium leading-relaxed">
            This section of the management portal is currently being built. It will provide enterprise-level controls for this domain.
          </p>
          
          <button className="mt-8 px-6 py-2.5 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-gray-300 rounded-xl font-semibold text-sm transition-all border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-none">
            Go Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
