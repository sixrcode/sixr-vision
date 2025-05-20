"use client";

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useCallback } from 'react';
import type { AudioData } from '@/types';
import { INITIAL_AUDIO_DATA } from '@/lib/constants';

type AudioDataContextType = {
  audioData: AudioData;
  setAudioData: (data: Partial<AudioData>) => void;
};

const AudioDataContext = createContext<AudioDataContextType | undefined>(undefined);

export function AudioDataProvider({ children }: { children: ReactNode }) {
  const [audioData, setAudioDataState] = useState<AudioData>(INITIAL_AUDIO_DATA);

  const setAudioData = useCallback((data: Partial<AudioData>) => {
    setAudioDataState((prev) => ({ ...prev, ...data }));
  }, []);
  
  return (
    <AudioDataContext.Provider value={{ audioData, setAudioData }}>
      {children}
    </AudioDataContext.Provider>
  );
}

export function useAudioData(): AudioDataContextType {
  const context = useContext(AudioDataContext);
  if (context === undefined) {
    throw new Error('useAudioData must be used within an AudioDataProvider');
  }
  return context;
}
