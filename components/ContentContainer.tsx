import React, { useState, useEffect, useRef, forwardRef, useCallback } from 'react';
import { jsPDF } from 'jspdf';
import type { QuizQuestion, LoadingStates, ActiveTab } from '../types';
import { generateContentFromVideo, generateQuizFromTranscript } from '../services/geminiService';
import { QUIZ_FROM_TRANSCRIPT_PROMPT, SUMMARY_FROM_VIDEO_PROMPT, TRANSCRIPT_FROM_VIDEO_PROMPT } from '../lib/prompts';

interface ContentContainerProps {
  contentBasis: string;
  onLoadingStateChange?: (isLoading: boolean) => void;
}

const ContentContainer = forwardRef<HTMLDivElement, ContentContainerProps>(({ contentBasis, onLoadingStateChange }, ref) => {
  const [videoTitle, setVideoTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [transcript, setTranscript] = useState('');
  const [quiz, setQuiz] = useState<QuizQuestion[]>([]);
  const [userSelections, setUserSelections] = useState<(string | null)[]>([]);
  const [quizScore, setQuizScore] = useState<number | null>(null);

  const [loadingStates, setLoadingStates] = useState<LoadingStates>({ summary: 'idle', transcript: 'idle', quiz: 'idle' });
  const [errors, setErrors] = useState<{ [key in ActiveTab]?: string }>({});
  const [activeTab, setActiveTab] = useState<ActiveTab>('summary');

  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');

  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      const femaleEnVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Female') || v.name.includes('Samantha') || v.name.includes('Zira'))) || voices.find(v => v.lang.startsWith('en'));
      setSelectedVoice(femaleEnVoice || null);
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  useEffect(() => {
    onLoadingStateChange?.(Object.values(loadingStates).some(s => s === 'loading'));
  }, [loadingStates, onLoadingStateChange]);

  const fetchInitialContent = useCallback(async () => {
    if (!contentBasis) return;
    setLoadingStates({ summary: 'loading', transcript: 'loading', quiz: 'idle' });
    setErrors({});
    setSummary(''); setTranscript(''); setQuiz([]); setUserSelections([]); setQuizScore(null);
    setVideoTitle('');
    setActiveTab('summary');
    
    // Fetch summary
    generateContentFromVideo(SUMMARY_FROM_VIDEO_PROMPT, contentBasis)
      .then(jsonString => {
        try {
          const data = JSON.parse(jsonString);
          setSummary(data.summary || '');
          setVideoTitle(data.title || 'Untitled Video');
          setLoadingStates(prev => ({ ...prev, summary: 'ready' }));
        } catch(e) {
          console.error("Failed to parse summary JSON from AI:", e);
          throw new Error("AI returned invalid summary data.");
        }
      }).catch(err => {
        console.error('Error generating summary:', err);
        setErrors(prev => ({ ...prev, summary: err instanceof Error ? err.message : 'Unknown error' }));
        setLoadingStates(prev => ({ ...prev, summary: 'error' }));
      });
      
    // Fetch transcript
    generateContentFromVideo(TRANSCRIPT_FROM_VIDEO_PROMPT, contentBasis)
      .then(jsonString => {
        try {
          const data = JSON.parse(jsonString);
          setTranscript(data.transcript || '');
          setVideoTitle(prev => prev || data.title || 'Untitled Video');
          setLoadingStates(prev => ({ ...prev, transcript: 'ready' }));
        } catch (e) {
          console.error("Failed to parse transcript JSON from AI:", e);
          throw new Error("AI returned invalid transcript data.");
        }
      }).catch(err => {
        console.error('Error generating transcript:', err);
        setErrors(prev => ({ ...prev, transcript: err instanceof Error ? err.message : 'Unknown error' }));
        setLoadingStates(prev => ({ ...prev, transcript: 'error' }));
      });

  }, [contentBasis]);

  useEffect(() => {
    fetchInitialContent();
    return () => {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentBasis]);

  const handleGenerateQuiz = async () => {
    if (loadingStates.transcript !== 'ready' || !transcript || loadingStates.quiz === 'loading') return;
    setLoadingStates(prev => ({ ...prev, quiz: 'loading' }));
    setErrors(prev => ({ ...prev, quiz: undefined }));
    setQuiz([]); setUserSelections([]); setQuizScore(null);

    try {
      const fullPrompt = `${QUIZ_FROM_TRANSCRIPT_PROMPT}\n\n---\nVideo Transcript:\n${transcript}\n---`;
      const jsonText = await generateQuizFromTranscript(fullPrompt);
      
      let jsonStr = jsonText.trim();
      const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
      const match = jsonStr.match(fenceRegex);
      if (match && match[2]) {
        jsonStr = match[2].trim();
      }
      
      const parsedQuiz: QuizQuestion[] = JSON.parse(jsonStr);
      if (Array.isArray(parsedQuiz) && parsedQuiz.length > 0) {
        setQuiz(parsedQuiz);
        setUserSelections(new Array(parsedQuiz.length).fill(null));
        setLoadingStates(prev => ({ ...prev, quiz: 'ready' }));
      } else {
        throw new Error("Parsed data is not a valid quiz array.");
      }
    } catch (err) {
      console.error('Error generating or parsing quiz:', err);
      setErrors(prev => ({ ...prev, quiz: `Failed to generate or parse quiz. AI response may not be valid. Details: ${err instanceof Error ? err.message : String(err)}`}));
      setLoadingStates(prev => ({ ...prev, quiz: 'error' }));
    }
  };
  
  const handleOptionSelect = (qIndex: number, option: string) => {
    if (quizScore !== null) return;
    const newSelections = [...userSelections];
    newSelections[qIndex] = option;
    setUserSelections(newSelections);

    if (newSelections.every(s => s !== null)) {
      const score = newSelections.reduce((acc, sel, i) => acc + (sel === quiz[i].answer ? 1 : 0), 0);
      setQuizScore(score);
    }
  };

  const handlePlayAudio = (text: string) => {
    if (isPlayingAudio) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
      return;
    }
    if (!selectedVoice) {
      alert("No speech synthesis voice is available on your browser.");
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = selectedVoice;
    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = () => setIsPlayingAudio(false);
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setIsPlayingAudio(true);
  };
  
  const handleCopy = (textToCopy: string) => {
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 2000);
    }).catch(err => console.error("Failed to copy text:", err));
  };
  
  const handleDownload = (type: 'Summary' | 'Transcript') => {
    const content = type === 'Summary' ? summary : transcript;
    if (!content || !videoTitle) return;

    const sanitizedTitle = videoTitle.replace(/[^a-z0-9]/gi, '_').slice(0, 50);
    const fileName = `${type}_${sanitizedTitle}.pdf`;
    
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    
    const margin = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const usableWidth = pageWidth - margin * 2;
    let y = margin;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    const titleLines = doc.splitTextToSize(videoTitle.toUpperCase(), usableWidth);
    doc.text(titleLines, margin, y);
    y += (titleLines.length * 7) + 5;

    doc.setDrawColor(180, 180, 180);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    const lineHeight = 5; // in mm
    const contentLines = doc.splitTextToSize(content, usableWidth);
    
    for (const line of contentLines) {
        if (y + lineHeight > pageHeight - margin) {
            doc.addPage();
            y = margin;
        }
        doc.text(line, margin, y);
        y += lineHeight; 
    }

    doc.save(fileName);
  };
  
  const renderTabButton = (tab: ActiveTab, label: string, icon: React.ReactNode) => (
    <button
      className={`flex-1 flex justify-center items-center gap-2 px-4 py-3 text-sm font-semibold rounded-t-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#02474a] focus:ring-white ${activeTab === tab ? 'bg-[#02474a] text-white' : 'text-teal-100 hover:bg-[#035d61] hover:text-white'}`}
      onClick={() => setActiveTab(tab)}
      aria-selected={activeTab === tab}
    >
      {icon} {label}
    </button>
  );

  const renderLoading = (contentType: string) => (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <div className="w-10 h-10 border-4 border-[#035d61] border-t-white rounded-full animate-spin mb-6"></div>
        <p className="text-lg font-semibold text-white">Generating {contentType}...</p>
        <p className="text-teal-100 mt-1">AI is working its magic. Please wait.</p>
    </div>
  );

  const renderError = (contentType: string, onRetry?: () => void) => (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center text-red-400">
       <svg className="w-12 h-12 mb-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
       <h3 className="text-lg font-semibold mb-2">Error Generating {contentType}</h3>
       <p className="text-sm max-w-md">{errors[contentType.toLowerCase() as ActiveTab]}</p>
       {onRetry && <button onClick={onRetry} className="mt-6 px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors">Try Again</button>}
    </div>
  );

  const renderContent = () => {
    switch(activeTab) {
      case 'summary':
        if (loadingStates.summary === 'loading') return renderLoading('Summary');
        if (loadingStates.summary === 'error') return renderError('Summary');
        return (
          <div className="p-4 sm:p-6">
            <div className="flex items-center flex-wrap gap-4 mb-4">
              <button onClick={() => handlePlayAudio(summary)} disabled={!summary || !selectedVoice} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#035d61] bg-white rounded-full hover:bg-gray-200 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-lg">
                {isPlayingAudio ? <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg> : <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>}
                {isPlayingAudio ? 'Stop' : 'Listen'}
              </button>
              <button onClick={() => handleCopy(summary)} disabled={!summary} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#035d61] bg-white rounded-full hover:bg-gray-200 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-lg">
                 {copyStatus === 'copied' ? <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg> : <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>}
                 {copyStatus === 'copied' ? 'Copied!' : 'Copy'}
              </button>
              <button onClick={() => handleDownload('Summary')} disabled={!summary} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#035d61] bg-white rounded-full hover:bg-gray-200 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-lg">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M5 20h14v-2H5v2zM19 9h-4V3H9v6H5l7 7 7-7z"/></svg>
                Download
              </button>
            </div>
            <div className="text-base leading-relaxed whitespace-pre-wrap text-teal-50 prose prose-invert max-w-none">{summary || 'Summary will appear here.'}</div>
          </div>
        );
      case 'transcript':
        if (loadingStates.transcript === 'loading') return renderLoading('Transcript');
        if (loadingStates.transcript === 'error') return renderError('Transcript');
        return (
          <div className="p-4 sm:p-6">
            <div className="mb-4 flex flex-wrap gap-4">
              <button onClick={() => handleCopy(transcript)} disabled={!transcript} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#035d61] bg-white rounded-full hover:bg-gray-200 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-lg">
                 {copyStatus === 'copied' ? <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg> : <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>}
                 {copyStatus === 'copied' ? 'Copied!' : 'Copy'}
              </button>
              <button onClick={() => handleDownload('Transcript')} disabled={!transcript} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#035d61] bg-white rounded-full hover:bg-gray-200 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-lg">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M5 20h14v-2H5v2zM19 9h-4V3H9v6H5l7 7 7-7z"/></svg>
                Download
              </button>
            </div>
            <pre className="text-sm leading-relaxed whitespace-pre-wrap font-sans text-teal-50">{transcript || 'Transcript will appear here.'}</pre>
          </div>
        );
      case 'quiz':
        if (loadingStates.quiz === 'loading') return renderLoading('Quiz');
        if (loadingStates.quiz === 'error') return renderError('Quiz', handleGenerateQuiz);
        if (loadingStates.transcript !== 'ready') return <div className="p-8 text-center text-teal-100">Please wait for the transcript to finish loading before generating a quiz.</div>
        if (quiz.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                    <h3 className="text-xl font-semibold text-white mb-2">Ready to test your knowledge?</h3>
                    <p className="text-sm text-teal-100 mb-6 max-w-sm">A quiz will be generated from the video transcript to help you master the content.</p>
                    <button onClick={handleGenerateQuiz} disabled={loadingStates.transcript !== 'ready'} className="px-6 py-3 text-base font-bold text-[#035d61] bg-white rounded-lg shadow-lg hover:bg-gray-200 active:scale-[0.98] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed">Generate Quiz</button>
                </div>
            )
        }
        return (
          <div className="p-4 sm:p-6 space-y-6">
            {quizScore !== null && (
              <div className="p-4 rounded-lg text-center bg-[#035d61] border border-white/20 shadow-lg">
                  <h3 className="text-xl font-bold text-emerald-300">Quiz Complete!</h3>
                  <p className="text-4xl font-bold mt-2 text-white">{quizScore} / {quiz.length}</p>
                  <p className="text-teal-100 mt-1">Great job!</p>
                  <button onClick={handleGenerateQuiz} className="mt-4 px-4 py-2 bg-white text-[#035d61] text-sm rounded-md hover:bg-gray-200 transition">Take a New Quiz</button>
              </div>
            )}
            {quiz.map((q, i) => {
              const userAnswer = userSelections[i];
              const isAnswered = userAnswer !== null;
              const isCorrect = isAnswered && userAnswer === q.answer;
              return (
                <div key={i} className="pb-6 border-b border-white/10 last:border-b-0">
                  <p className="font-semibold text-white mb-3">{i+1}. {q.question}</p>
                  <div className="space-y-2">
                    {q.options.map(opt => {
                        let buttonClass = 'w-full text-left p-3 rounded-lg border-2 transition-all duration-200 text-sm flex items-center justify-between';
                        if (isAnswered) {
                            if (opt === q.answer) buttonClass += ' bg-green-500/10 border-green-500 text-green-300 font-semibold';
                            else if (opt === userAnswer) buttonClass += ' bg-red-500/10 border-red-500 text-red-300';
                            else buttonClass += ' border-[#035d61] bg-[#023c3f] opacity-60 cursor-not-allowed';
                        } else {
                            buttonClass += ' border-[#035d61] bg-[#023c3f]/50 hover:bg-[#035d61] hover:border-white';
                        }
                        return (
                            <button key={opt} onClick={() => handleOptionSelect(i, opt)} disabled={isAnswered} className={buttonClass}>
                                {opt}
                                {isAnswered && opt === q.answer && <svg className="w-5 h-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>}
                                {isAnswered && opt === userAnswer && opt !== q.answer && <svg className="w-5 h-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>}
                            </button>
                        )
                    })}
                  </div>
                  {isAnswered && q.explanation && <div className={`mt-3 p-3 rounded-lg text-sm bg-[#035d61]/70`}><span className="font-bold text-emerald-300">Explanation:</span> <span className="text-teal-50">{q.explanation}</span></div>}
                </div>
              )
            })}
          </div>
        );
    }
  };

  return (
    <div ref={ref} className="h-full flex flex-col bg-[#02474a]">
      <nav className="flex-shrink-0 flex border-b border-white/10 bg-[#023c3f]/30 p-1">
        {renderTabButton('summary', 'Summary', <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"/></svg>)}
        {renderTabButton('transcript', 'Transcript', <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>)}
        {renderTabButton('quiz', 'Quiz', <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z"/></svg>)}
      </nav>
      <div className="flex-grow overflow-y-auto custom-scrollbar bg-[#02474a]">
        {renderContent()}
      </div>
    </div>
  );
});

export default ContentContainer;