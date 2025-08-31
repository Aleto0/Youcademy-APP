import React, { useState, useRef, useCallback } from 'react';
import { getYoutubeEmbedUrl, validateYoutubeUrl } from './lib/youtube';
import ContentContainer from './components/ContentContainer';

const Spinner: React.FC = () => (
  <svg className="animate-spin h-5 w-5 text-[#035d61]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

export default function App() {
  const [videoUrl, setVideoUrl] = useState('');
  const [urlValidating, setUrlValidating] = useState(false);
  const [contentLoading, setContentLoading] = useState(false);
  const [reloadCounter, setReloadCounter] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const isInitialView = !videoUrl && !urlValidating;

  const handleSubmit = async () => {
    const inputValue = inputRef.current?.value.trim() || '';
    if (!inputValue || urlValidating) return;

    setUrlValidating(true);
    setVideoUrl('');
    setContentLoading(false);

    const validationResult = await validateYoutubeUrl(inputValue);
    if (validationResult.isValid) {
      setVideoUrl(inputValue);
      setReloadCounter((c) => c + 1);
    } else {
      alert(validationResult.error);
      if (inputRef.current) inputRef.current.value = '';
    }
    setUrlValidating(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };
  
  const handleContentLoadingStateChange = useCallback((isLoading: boolean) => {
    setContentLoading(isLoading);
  }, []);


  return (
    <div className="bg-[#035d61] text-white min-h-screen">
      <main className={`transition-all duration-500 ${isInitialView ? 'flex flex-col items-center justify-center min-h-screen p-4' : 'p-4 sm:p-8 flex flex-col lg:flex-row gap-8 min-h-screen'}`}>
        
        {/* Left Side */}
        <div className={isInitialView ? 'w-full max-w-xl flex flex-col gap-6' : 'w-full lg:w-2/5 xl:w-1/3 flex-shrink-0 flex flex-col gap-6 h-auto lg:h-[calc(100vh-4rem)] lg:overflow-y-auto custom-scrollbar lg:pr-4'}>
          <header className="text-center">
            <h1 className="font-poppins text-5xl md:text-6xl font-bold uppercase tracking-wide bg-clip-text text-transparent bg-gradient-to-r from-emerald-300 to-teal-200 py-2">
              YOUCADEMY
            </h1>
            <p className="text-base text-teal-100 max-w-md mx-auto mt-3 leading-relaxed">
              Your personal AI learning assistant. Unlock summaries, transcripts, and quizzes from any YouTube video.
            </p>
          </header>

          <div className="w-full space-y-4">
            <label htmlFor="youtube-url" className="sr-only">
              Enter YouTube Video URL
            </label>
            <div className="relative flex items-center">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2">
                <svg className="w-5 h-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M21.822 7.425a3.284 3.284 0 0 0-2.321-2.321C17.695 4.5 12 4.5 12 4.5s-5.695 0-7.501.604A3.284 3.284 0 0 0 2.178 7.425C1.575 9.231 1.5 12 1.5 12s0 2.769.678 4.575a3.284 3.284 0 0 0 2.321 2.321C6.305 19.5 12 19.5 12 19.5s5.695 0 7.501-.604a3.284 3.284 0 0 0 2.321-2.321C22.425 14.769 22.5 12 22.5 12s0-2.769-.678-4.575zM9.75 15.562V8.438l6 3.562-6 3.563z" clipRule="evenodd" />
                </svg>
              </div>
              <input
                ref={inputRef}
                id="youtube-url"
                aria-label="YouTube video URL input"
                className="w-full pl-11 pr-4 py-3 border border-[#02474a] rounded-lg bg-[#023c3f] text-base placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-transparent transition"
                type="text"
                placeholder="Paste a YouTube URL..."
                disabled={urlValidating || contentLoading}
                onKeyDown={handleKeyDown}
                onChange={() => videoUrl && setVideoUrl('')}
              />
            </div>
          
            <button
              onClick={handleSubmit}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 text-base font-bold text-[#035d61] bg-white rounded-lg shadow-lg hover:bg-gray-200 active:scale-[0.98] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-gray-400 disabled:text-gray-600"
              disabled={urlValidating || contentLoading}
              aria-live="polite"
            >
              {urlValidating ? <><Spinner /> Validating...</> : 
               contentLoading ? <><Spinner /> Generating...</> : 'Start Learning'}
            </button>
          </div>
          
          <div className={`aspect-video w-full bg-black rounded-xl shadow-lg relative overflow-hidden transition-all duration-300 ring-1 ring-black/20 ${isInitialView ? 'hidden' : 'block'}`}>
            {videoUrl && (
              <iframe
                className="absolute top-0 left-0 w-full h-full"
                src={getYoutubeEmbedUrl(videoUrl)}
                title="YouTube video player"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen>
              </iframe>
            )}
          </div>
        </div>
        
        {/* Right Side */}
        {!isInitialView && (
          <div className="w-full lg:w-3/5 xl:w-2/3 flex-shrink-0 h-[calc(100vh-4rem)]">
            <div className="h-full w-full bg-[#023c3f]/50 rounded-xl shadow-2xl ring-1 ring-black/20 flex flex-col overflow-hidden backdrop-blur-sm">
               {videoUrl ? (
                <ContentContainer
                  key={reloadCounter}
                  contentBasis={videoUrl}
                  onLoadingStateChange={handleContentLoadingStateChange}
                />
              ) : urlValidating ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-8 text-gray-300" aria-live="polite">
                  <svg className="w-16 h-16 text-emerald-300 opacity-70 mb-4 animate-pulse" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                     <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
                   </svg>
                  <h2 className="text-xl font-semibold text-white mb-2">Unlocking Knowledge...</h2>
                  <p>Validating your YouTube URL. Please wait.</p>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}