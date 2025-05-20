
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import type { AudioData } from '@/types';
import { useAudioData } from '@/providers/AudioDataProvider';
import { useSettings } from '@/providers/SettingsProvider';
import { INITIAL_AUDIO_DATA } from '@/lib/constants';

// Simple Beat Detection Threshold
const BEAT_DETECTION_THRESHOLD = 0.7; // Adjust this based on sensitivity
const RMS_SMOOTHING_FACTOR = 0.1; // For smoothing RMS values

// AGC Constants
const AGC_TARGET_RMS = 0.25; // Target RMS level for AGC (0-1 scale)
const AGC_MIN_GAIN = 0.1;   // Minimum gain AGC will apply
const AGC_MAX_GAIN = 4.0;   // Maximum gain AGC will apply (to prevent over-amplifying noise)
const AGC_ATTACK_TIME_CONSTANT = 0.03; // Time constant for gain reduction (seconds)
const AGC_RELEASE_TIME_CONSTANT = 0.4; // Time constant for gain increase (seconds)


export function useAudioAnalysis() {
  const { settings } = useSettings();
  const { audioData: currentGlobalAudioData, setAudioData } = useAudioData(); 
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [lastBeatTime, setLastBeatTime] = useState(0);
  const [beatTimestamps, setBeatTimestamps] = useState<number[]>([]);
  const [previousRms, setPreviousRms] = useState(0);


  const calculateEnergy = useCallback((spectrum: Uint8Array): Pick<AudioData, 'bassEnergy' | 'midEnergy' | 'trebleEnergy' | 'rms' | 'beat'> => {
    if (!audioContextRef.current) return { bassEnergy: 0, midEnergy: 0, trebleEnergy: 0, rms: 0, beat: false};
    const nyquist = audioContextRef.current.sampleRate / 2;
    const bassEndFreq = 250; // Hz
    const midEndFreq = 4000; // Hz

    const bassBins = Math.floor((bassEndFreq / nyquist) * spectrum.length);
    const midBins = Math.floor((midEndFreq / nyquist) * spectrum.length);

    let bassSum = 0;
    for (let i = 0; i < bassBins; i++) {
      bassSum += spectrum[i];
    }
    const bassEnergy = bassBins > 0 ? (bassSum / bassBins) / 255 : 0;

    let midSum = 0;
    for (let i = bassBins; i < midBins; i++) {
      midSum += spectrum[i];
    }
    const midEnergy = (midBins - bassBins) > 0 ? (midSum / (midBins - bassBins)) / 255 : 0;
    
    let trebleSum = 0;
    for (let i = midBins; i < spectrum.length; i++) {
      trebleSum += spectrum[i];
    }
    const trebleEnergy = (spectrum.length - midBins) > 0 ? (trebleSum / (spectrum.length - midBins)) / 255 : 0;
    
    let sumOfSquares = 0;
    for (let i = 0; i < spectrum.length; i++) {
      sumOfSquares += (spectrum[i] / 255) * (spectrum[i] / 255);
    }
    let rms = Math.sqrt(sumOfSquares / spectrum.length);
    rms = previousRms + (rms - previousRms) * RMS_SMOOTHING_FACTOR; // Apply smoothing
    setPreviousRms(rms);


    let beat = false;
    const currentTime = performance.now();
    if ((bassEnergy > BEAT_DETECTION_THRESHOLD && bassEnergy > midEnergy && bassEnergy > trebleEnergy && currentTime - lastBeatTime > 200) || 
        (rms > previousRms * 1.2 && rms > 0.1 && currentTime - lastBeatTime > 150) ) { 
      beat = true;
      setLastBeatTime(currentTime);
      setBeatTimestamps(prev => {
        const newTimestamps = [...prev, currentTime].slice(-20); 
        return newTimestamps;
      });
    }

    return { bassEnergy, midEnergy, trebleEnergy, rms, beat };
  }, [lastBeatTime, previousRms]);

  const estimateBPM = useCallback((): number => {
    if (beatTimestamps.length < 5) return currentGlobalAudioData.bpm || 120;

    const intervals = [];
    for (let i = 1; i < beatTimestamps.length; i++) {
      intervals.push(beatTimestamps[i] - beatTimestamps[i-1]);
    }
    
    if (intervals.length === 0) return currentGlobalAudioData.bpm || 120;

    intervals.sort((a, b) => a - b);
    const medianInterval = intervals[Math.floor(intervals.length / 2)];
    
    if (medianInterval === 0 || medianInterval < 50 ) return currentGlobalAudioData.bpm || 120;
    
    const bpm = 60000 / medianInterval;
    const smoothedBpm = Math.round(currentGlobalAudioData.bpm * 0.8 + bpm * 0.2);
    return smoothedBpm;
  }, [beatTimestamps, currentGlobalAudioData.bpm]);

  const analyze = useCallback(() => {
    if (!analyserRef.current || !dataArrayRef.current || !audioContextRef.current || !isInitialized) {
      if (isInitialized && audioContextRef.current && audioContextRef.current.state === 'running') {
         animationFrameIdRef.current = requestAnimationFrame(analyze);
      }
      return;
    }

    analyserRef.current.getByteFrequencyData(dataArrayRef.current);
    const energyAndRms = calculateEnergy(dataArrayRef.current);
    const bpm = estimateBPM();

    setAudioData({
      spectrum: new Uint8Array(dataArrayRef.current), 
      ...energyAndRms,
      bpm,
    });

    if (settings.enableAgc && gainNodeRef.current && audioContextRef.current.state === 'running') {
        const currentRms = energyAndRms.rms; 
        const currentGain = gainNodeRef.current.gain.value;

        if (currentRms > 0.005) { 
            let targetGain = currentGain * (AGC_TARGET_RMS / currentRms);
            targetGain = Math.max(AGC_MIN_GAIN, Math.min(AGC_MAX_GAIN, targetGain));
            
            const timeConstant = currentRms > AGC_TARGET_RMS ? AGC_ATTACK_TIME_CONSTANT : AGC_RELEASE_TIME_CONSTANT;

            gainNodeRef.current.gain.setTargetAtTime(
                targetGain,
                audioContextRef.current.currentTime,
                timeConstant
            );
        } else { 
            if (currentGain > 1.5) { 
                 gainNodeRef.current.gain.setTargetAtTime(
                    1.0, 
                    audioContextRef.current.currentTime,
                    AGC_RELEASE_TIME_CONSTANT * 2 
                );
            }
        }
    }
    animationFrameIdRef.current = requestAnimationFrame(analyze);
  }, [settings.enableAgc, calculateEnergy, estimateBPM, setAudioData, isInitialized]);


  const stopAudioAnalysis = useCallback(async () => {
    console.log("stopAudioAnalysis called. Current state - isInitialized:", isInitialized);
    if (!isInitialized && !audioContextRef.current && !mediaStreamRef.current) {
      console.log("Audio not initialized or already stopped. Aborting stopAudioAnalysis.");
      setIsInitialized(false);
      setAudioData(INITIAL_AUDIO_DATA);
      setError(null);
      return;
    }

    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }

    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    if (gainNodeRef.current) {
      gainNodeRef.current.disconnect();
      gainNodeRef.current = null;
    }
    analyserRef.current = null; 
    
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
      console.log("MediaStream tracks stopped and stream released.");
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        await audioContextRef.current.close();
        console.log("AudioContext closed.");
      } catch (e) {
        console.error("Error closing audio context", e);
      }
    }
    audioContextRef.current = null;
    
    setIsInitialized(false);
    setAudioData(INITIAL_AUDIO_DATA); 
    setError(null); 
    setPreviousRms(0);
    setLastBeatTime(0);
    setBeatTimestamps([]);
    console.log("Audio analysis stopped and state reset. isInitialized set to false.");
  }, [isInitialized, setAudioData]); // Removed settings from deps, they are read via useSettings()

  const initializeAudio = useCallback(async () => {
    console.log("initializeAudio called. Current state - isInitialized:", isInitialized, "AudioContext:", audioContextRef.current?.state);
    if (isInitialized || (audioContextRef.current && audioContextRef.current.state === 'running')) {
      console.log("Audio already initialized and running. Aborting initializeAudio.");
      return;
    }
    setError(null);

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      await audioContextRef.current.close().catch(e => console.warn("Error closing existing audio context during re-init", e));
    }
    audioContextRef.current = null; 
    if (sourceNodeRef.current) sourceNodeRef.current.disconnect();
    sourceNodeRef.current = null;
    if (gainNodeRef.current) gainNodeRef.current.disconnect();
    gainNodeRef.current = null;
    analyserRef.current = null;
    dataArrayRef.current = null;


    try {
      console.log("Requesting microphone access...");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      mediaStreamRef.current = stream;
      console.log("Microphone access granted.");

      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      console.log("AudioContext created. State:", audioContextRef.current.state);

      if (audioContextRef.current.state === 'suspended') {
        console.log("AudioContext is suspended, attempting to resume...");
        await audioContextRef.current.resume();
        console.log("AudioContext resumed. New state:", audioContextRef.current.state);
      }
      
      if (audioContextRef.current.state !== 'running') {
        throw new Error(`AudioContext could not be started or resumed. State: ${audioContextRef.current.state}`);
      }
      
      sourceNodeRef.current = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      gainNodeRef.current = audioContextRef.current.createGain();

      analyserRef.current.fftSize = settings.fftSize;
      analyserRef.current.smoothingTimeConstant = 0.8; 
      
      dataArrayRef.current = new Uint8Array(analyserRef.current.frequencyBinCount);

      sourceNodeRef.current.connect(gainNodeRef.current);
      gainNodeRef.current.connect(analyserRef.current);
      
      if (settings.enableAgc) {
        gainNodeRef.current.gain.setValueAtTime(1.0, audioContextRef.current.currentTime);
      } else {
        gainNodeRef.current.gain.setValueAtTime(settings.gain, audioContextRef.current.currentTime);
      }

      setIsInitialized(true);
      console.log("Audio initialized successfully. isInitialized set to true.");
      setError(null); 
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current); 
      animationFrameIdRef.current = requestAnimationFrame(analyze);
    } catch (err) {
      console.error("Error initializing audio:", err);
      setError(err instanceof Error ? err.message : String(err));
      setIsInitialized(false);
      setAudioData(INITIAL_AUDIO_DATA); 
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(e => console.warn("Error closing audio context after failure", e));
      }
      audioContextRef.current = null;
      sourceNodeRef.current = null;
      gainNodeRef.current = null;
      analyserRef.current = null;
    }
  }, [isInitialized, settings.fftSize, settings.gain, settings.enableAgc, analyze, setAudioData]); // Moved analyze here

  // Effect for managing gain based on settings
  useEffect(() => {
    if (!isInitialized || !audioContextRef.current || !gainNodeRef.current || audioContextRef.current.state !== 'running') return;

    if (settings.enableAgc) {
      // AGC logic is handled in analyze()
    } else {
        gainNodeRef.current.gain.setTargetAtTime(
            settings.gain,
            audioContextRef.current.currentTime,
            0.05 
        );
    }
  }, [settings.enableAgc, settings.gain, isInitialized]); // Removed audioContextRef.current from deps

  // Effect for managing FFT size
  useEffect(() => {
    if (!analyserRef.current || !isInitialized) return;

    if (settings.fftSize !== analyserRef.current.fftSize) {
      analyserRef.current.fftSize = settings.fftSize;
      const newFrequencyBinCount = analyserRef.current.frequencyBinCount;
      // Ensure dataArrayRef is updated or that analyze loop can handle this change
      dataArrayRef.current = new Uint8Array(newFrequencyBinCount); 
      setAudioData(prev => ({ 
        ...prev, 
        spectrum: new Uint8Array(newFrequencyBinCount).fill(0) 
      }));
    }
  }, [settings.fftSize, isInitialized, setAudioData]); // Removed dataArrayRef.current from deps

  // Central cleanup effect
  useEffect(() => {
    // This effect now only runs on mount and unmount of the component using the hook.
    return () => {
      console.log("useAudioAnalysis hook is unmounting, calling stopAudioAnalysis.");
      // We need to ensure stopAudioAnalysis is stable or its dependencies are minimal
      // Forcing a call to a locally defined stop function might be safer if stopAudioAnalysis from useCallback has stale closure
      
      // Local stop function to avoid useCallback complexities in cleanup for this specific case
      const localStop = async () => {
        console.log("Local stop called from cleanup effect.");
        if (animationFrameIdRef.current) {
            cancelAnimationFrame(animationFrameIdRef.current);
            animationFrameIdRef.current = null;
        }
        if (sourceNodeRef.current) sourceNodeRef.current.disconnect();
        if (gainNodeRef.current) gainNodeRef.current.disconnect();
        
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            try {
                await audioContextRef.current.close();
                console.log("AudioContext closed via local stop.");
            } catch (e) { console.error("Error closing AC in local stop", e); }
        }
        // Reset non-ref states only if truly unmounting, not handled here directly
        // This cleanup mainly focuses on browser resources.
      };
      localStop();
    };
  }, []); // Empty dependency array: runs only on mount and unmount

  return { initializeAudio, stopAudioAnalysis, isInitialized, error };
}

