import React, { useRef, useState, useEffect } from 'react';

interface FileUploadProps {
  onFileSelected: (file: File) => void;
  isLoading: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileSelected, isLoading }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  // Simulate progress when loading
  useEffect(() => {
    if (isLoading) {
      setProgress(0);
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 95) return prev;
          return prev + Math.random() * 10;
        });
      }, 200);
      return () => clearInterval(interval);
    } else {
      setProgress(100);
    }
  }, [isLoading]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file: File) => {
    if (file.name.endsWith('.pfx') || file.name.endsWith('.p12')) {
      setFileName(file.name);
      onFileSelected(file);
    } else {
      // Inline error feedback
      const box = document.getElementById('dropzone-box');
      if (box) {
          box.classList.add('animate-shake', 'border-red-500');
          setTimeout(() => box.classList.remove('animate-shake', 'border-red-500'), 500);
      }
      alert("Invalid file type. Please upload a .pfx or .p12 file");
    }
  };

  const onButtonClick = () => {
    inputRef.current?.click();
  };

  return (
    <div className="w-full">
        <div 
        id="dropzone-box"
        className={`relative w-full p-10 border-2 border-dashed rounded-xl transition-all duration-300 ease-in-out flex flex-col items-center justify-center text-center group
            ${dragActive 
                ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 scale-[1.02]' 
                : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:border-brand-400 dark:hover:border-brand-500'}
            ${isLoading ? 'opacity-90 pointer-events-none' : ''}
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        >
        <input
            ref={inputRef}
            type="file"
            accept=".pfx,.p12"
            className="hidden"
            onChange={handleChange}
        />
        
        <div className={`p-4 rounded-full mb-4 transition-colors duration-300 ${dragActive ? 'bg-white dark:bg-slate-800 text-brand-600 scale-110' : 'bg-brand-100 dark:bg-slate-700 text-brand-600 dark:text-brand-400'}`}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
        </div>

        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-2">
            {fileName ? fileName : "Upload Digital Certificate"}
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-xs">
            {fileName ? "Ready to decrypt." : "Drag & drop your .pfx or .p12 file here, or click to browse"}
        </p>

        {!fileName && (
            <button
            onClick={onButtonClick}
            className="px-6 py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-medium rounded-lg shadow-sm hover:bg-slate-50 dark:hover:bg-slate-600 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 dark:focus:ring-offset-slate-900"
            >
            Select File
            </button>
        )}
        
        {fileName && (
            <button
            onClick={(e) => { e.stopPropagation(); setFileName(null); if (inputRef.current) inputRef.current.value = ''; }}
            className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-medium mt-2 z-10"
            >
            Remove file
            </button>
        )}
        
        {/* Loading Overlay/Progress */}
        {isLoading && (
            <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-xl z-20">
                <div className="w-64 bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 mb-4 overflow-hidden">
                    <div className="bg-brand-600 h-2.5 rounded-full transition-all duration-300 ease-out" style={{ width: `${progress}%` }}></div>
                </div>
                <span className="text-sm font-medium text-brand-700 dark:text-brand-400 animate-pulse">Processing Certificate...</span>
            </div>
        )}
        </div>
        <style>{`
            @keyframes shake {
                0%, 100% { transform: translateX(0); }
                10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
                20%, 40%, 60%, 80% { transform: translateX(4px); }
            }
            .animate-shake {
                animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both;
            }
        `}</style>
    </div>
  );
};