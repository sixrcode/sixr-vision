
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import type { AudioData } from '@/types';
import { useAudioData } from '@/providers/AudioDataProvider';
import { useSettings } from '@/providers/SettingsProvider';
import { INITIAL_AUDIO_DATA } from '@/lib/constants';

// Beat Detection Parameters
const BEAT_DETECTION_BASS_THRESHOLD = 0.05; // Made more sensitive
const BEAT_DETECTION_RMS_INCREASE_FACTOR = 1.03; // Made more sensitive
const BEAT_DETECTION_RMS_MIN_THRESHOLD = 0.015; // Made more sensitive
const BEAT_REFRACTORY_BASS_MS = 40; // Reduced
const BEAT_REFRACTORY_RMS_MS = 30; // Reduced

const RMS_SMOOTHING_FACTOR = 0.1;

// AGC Constants
const AGC_TARGET_RMS = 0.25;
const AGC_MIN_GAIN = 0.1;
const AGC_MAX_GAIN = 4.0;
const AGC_ATTACK_TIME_CONSTANT = 0.03;
const AGC_RELEASE_TIME_CONSTANT = 0.4;

const EFFECTIVE_SILENCE_THRESHOLD_SUM = 5;

export function useAudioAnalysis() {
  const { settings } = useSettings();
  const { audioData: currentGlobalAudioData, setAudioData } = useAudioData();

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const localAnalysisLoopFrameIdRef = useRef<number | null>(null);

  const [isInitializedInternal, setIsInitializedInternalActual] = useState(false);
  const [errorInternal, setErrorInternalActual] = useState<string | null>(null);
  
  const isInitializedInternalRef = useRef(isInitializedInternal);
  useEffect(() => {
    isInitializedInternalRef.current = isInitializedInternal;
  }, [isInitializedInternal]);

  const setIsInitialized = useCallback((val: boolean) => {
    console.log(`setIsInitialized called with: ${val}. Previous isInitialized: ${isInitializedInternalRef.current}`);
    setIsInitializedInternalActual(val);
  }, []); // Dependency array is empty as setIsInitializedInternalActual is stable

  const setError = useCallback((val: string | null) => {
    console.log(`setError called with: ${val}. Previous error: ${errorInternalRef.current}`);
    setErrorInternalActual(val);
  }, []); // Dependency array is empty as setErrorInternalActual is stable


  const [lastBeatTime, setLastBeatTime] = useState(0);
  const [beatTimestamps, setBeatTimestamps] = useState<number[]>([]);
  const [previousRms, setPreviousRms] = useState(0);

  const stopAudioAnalysis = useCallback(async () => {
    console.log("stopAudioAnalysis called. Current state - isInitializedInternalRef.current:", isInitializedInternalRef.current);
    if (!isInitializedInternalRef.current && (!audioContextRef.current && !mediaStreamRef.current)) {
        console.log("Audio not initialized or already stopped. Aborting stopAudioAnalysis.");
        return;
    }

    if (localAnalysisLoopFrameIdRef.current) {
      cancelAnimationFrame(localAnalysisLoopFrameIdRef.current);
      localAnalysisLoopFrameIdRef.current = null;
      console.log("Analysis loop stopped by stopAudioAnalysis.");
    }

    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.disconnect(); } catch (e) { console.warn("Error disconnecting sourceNodeRef", e); }
      sourceNodeRef.current = null;
    }
    if (gainNodeRef.current) {
      try { gainNodeRef.current.disconnect(); } catch (e) { console.warn("Error disconnecting gainNodeRef", e); }
      gainNodeRef.current = null;
    }
    analyserRef.current = null; // No disconnect needed for AnalyserNode itself, just its inputs
    dataArrayRef.current = null;

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
      console.log("MediaStream tracks stopped and stream released.");
    }

    if (audioContextRef.current) {
      if (audioContextRef.current.state !== 'closed') {
        try {
          await audioContextRef.current.close();
          console.log("AudioContext closed.");
        } catch (e) {
          console.error("Error closing audio context in stopAudioAnalysis", e);
        }
      }
      audioContextRef.current = null;
    }

    setIsInitialized(false);
    setAudioData(INITIAL_AUDIO_DATA);
    setError(null); // Clear any previous errors
    setPreviousRms(0);
    setLastBeatTime(0);
    setBeatTimestamps([]);
    console.log("Audio analysis stopped and state reset. isInitialized set to false.");
  }, [setAudioData, setIsInitialized, setError]); // Depends on stable setters

  const initializeAudio = useCallback(async () => {
    console.log("initializeAudio called. Current state - isInitializedInternalRef.current:", isInitializedInternalRef.current, "AudioContext state:", audioContextRef.current?.state);

    if (isInitializedInternalRef.current && audioContextRef.current && audioContextRef.current.state === 'running') {
      console.log("Audio seems already initialized and running. Aborting initializeAudio.");
      return;
    }
    
    console.log("Performing cleanup before audio initialization...");
    await stopAudioAnalysis(); 
    console.log("Cleanup via stopAudioAnalysis finished.");
    
    setError(null); // Clear previous errors before attempting new init

    try {
      console.log("Requesting microphone access...");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      mediaStreamRef.current = stream;
      console.log("Microphone access granted.");

      const newAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = newAudioContext;
      console.log("AudioContext created. State:", newAudioContext.state);

      if (newAudioContext.state === 'suspended') {
        console.log("AudioContext is suspended, attempting to resume...");
        await newAudioContext.resume();
        console.log("AudioContext resumed. New state:", newAudioContext.state);
      }

      if (newAudioContext.state !== 'running') {
        throw new Error(`AudioContext could not be started/resumed. State: ${newAudioContext.state}`);
      }

      sourceNodeRef.current = newAudioContext.createMediaStreamSource(stream);
      analyserRef.current = newAudioContext.createAnalyser();
      gainNodeRef.current = newAudioContext.createGain();

      console.log("Analyser fftSize will be set to:", settings.fftSize);
      analyserRef.current.fftSize = settings.fftSize;
      analyserRef.current.smoothingTimeConstant = 0.3; 
      console.log("Analyser fftSize set to:", analyserRef.current.fftSize, "Resulting frequencyBinCount:", analyserRef.current.frequencyBinCount);
      dataArrayRef.current = new Uint8Array(analyserRef.current.frequencyBinCount);

      sourceNodeRef.current.connect(gainNodeRef.current);
      gainNodeRef.current.connect(analyserRef.current);

      if (settings.enableAgc) {
        gainNodeRef.current.gain.setValueAtTime(1.0, newAudioContext.currentTime);
      } else {
        gainNodeRef.current.gain.setValueAtTime(settings.gain, newAudioContext.currentTime);
      }
      console.log("GainNode initial value set to:", gainNodeRef.current.gain.value);

      setIsInitialized(true);
      setError(null);
      console.log("Audio initialized successfully. isInitialized set to true.");

    } catch (err) {
      console.error("Error initializing audio:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      setIsInitialized(false);
      // Attempt cleanup again if initialization failed mid-way
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        try { await audioContextRef.current.close(); } catch(e) { /* ignore */ }
        audioContextRef.current = null;
      }
    }
  }, [settings.fftSize, settings.gain, settings.enableAgc, stopAudioAnalysis, setIsInitialized, setError]);


  const calculateEnergy = useCallback((spectrum: Uint8Array, currentRmsSmoothed: number, currentLastBeatTime: number): Pick<AudioData, 'bassEnergy' | 'midEnergy' | 'trebleEnergy' | 'rms'> & { newBeat: boolean } => {
    if (!audioContextRef.current || !spectrum || spectrum.length === 0) {
        return { bassEnergy: 0, midEnergy: 0, trebleEnergy: 0, rms: 0, newBeat: false };
    }
    const nyquist = audioContextRef.current.sampleRate / 2;
    const bassEndFreq = 250;
    const midEndFreq = 4000;
    const spectrumLength = spectrum.length;

    const bassBins = Math.floor((bassEndFreq / nyquist) * spectrumLength);
    const midBins = Math.floor((midEndFreq / nyquist) * spectrumLength);

    let bassSum = 0;
    for (let i = 0; i < bassBins; i++) bassSum += spectrum[i] || 0;
    const bassEnergy = bassBins > 0 ? (bassSum / bassBins) / 255 : 0;

    let midSum = 0;
    for (let i = bassBins; i < midBins; i++) midSum += spectrum[i] || 0;
    const midEnergy = (midBins - bassBins) > 0 ? (midSum / (midBins - bassBins)) / 255 : 0;

    let trebleSum = 0;
    for (let i = midBins; i < spectrumLength; i++) trebleSum += spectrum[i] || 0;
    const trebleEnergy = (spectrumLength - midBins) > 0 ? (trebleSum / (spectrumLength - midBins)) / 255 : 0;

    let sumOfSquares = 0;
    for (let i = 0; i < spectrumLength; i++) sumOfSquares += ((spectrum[i] || 0) / 255) ** 2;
    let rmsRaw = spectrumLength > 0 ? Math.sqrt(sumOfSquares / spectrumLength) : 0;
    let rms = currentRmsSmoothed + (rmsRaw - currentRmsSmoothed) * RMS_SMOOTHING_FACTOR;

    let newBeat = false;
    const currentTime = performance.now();
     if (
        (bassEnergy > BEAT_DETECTION_BASS_THRESHOLD && currentTime - currentLastBeatTime > BEAT_REFRACTORY_BASS_MS) ||
        (rms > previousRms * BEAT_DETECTION_RMS_INCREASE_FACTOR && rms > BEAT_DETECTION_RMS_MIN_THRESHOLD && currentTime - currentLastBeatTime > BEAT_REFRACTORY_RMS_MS)
    ) {
      newBeat = true;
    }
    return { bassEnergy, midEnergy, trebleEnergy, rms, newBeat };
  }, [previousRms, lastBeatTime]); // previousRms and lastBeatTime are state variables from this hook

  const estimateBPM = useCallback((currentBeatTimestamps: number[], currentGlobalBpm: number): number => {
    if (currentBeatTimestamps.length < 5) return currentGlobalBpm || 120;
    const intervals = [];
    for (let i = 1; i < currentBeatTimestamps.length; i++) {
      intervals.push(currentBeatTimestamps[i] - currentBeatTimestamps[i-1]);
    }
    if (intervals.length === 0) return currentGlobalBpm || 120;
    intervals.sort((a, b) => a - b);
    const medianInterval = intervals[Math.floor(intervals.length / 2)];
    if (medianInterval === 0 || medianInterval < 50 ) return currentGlobalBpm || 120; // Avoid division by zero or too fast BPM
    const bpm = 60000 / medianInterval;
    const smoothedBpm = Math.round(currentGlobalBpm * 0.8 + bpm * 0.2);
    return smoothedBpm > 0 ? smoothedBpm : 120;
  }, []);

  const analyze = useCallback(() => {
    if (!analyserRef.current || !dataArrayRef.current || !audioContextRef.current || audioContextRef.current.state !== 'running' || !isInitializedInternalRef.current) {
       if (localAnalysisLoopFrameIdRef.current) {
        cancelAnimationFrame(localAnalysisLoopFrameIdRef.current);
        localAnalysisLoopFrameIdRef.current = null;
      }
      return;
    }

    const currentSpectrum = new Uint8Array(dataArrayRef.current.length);
    analyserRef.current.getByteFrequencyData(currentSpectrum);
    const spectrumSum = currentSpectrum.reduce((a, b) => a + b, 0);
    
    // console.log(
    //     '[RAW Audio Data] Sum:', spectrumSum,
    //     'Bins (first 5):', Array.from(currentSpectrum.slice(0,5)),
    //     'Manual Gain Setting:', settings.gain,
    //     'Actual GainNode Value:', gainNodeRef.current?.gain.value.toFixed(3)
    // );

    let energyAndRmsResult: Pick<AudioData, 'bassEnergy' | 'midEnergy' | 'trebleEnergy' | 'rms'> & { newBeat: boolean };
    let calculatedBpm = currentGlobalAudioData.bpm;
    let finalSpectrumToSet: Uint8Array;

    if (spectrumSum < EFFECTIVE_SILENCE_THRESHOLD_SUM) {
      energyAndRmsResult = { bassEnergy: 0, midEnergy: 0, trebleEnergy: 0, rms: 0, newBeat: false };
      finalSpectrumToSet = new Uint8Array(currentSpectrum.length).fill(0);
      setPreviousRms(0); // Reset smoothed RMS during silence
    } else {
      energyAndRmsResult = calculateEnergy(currentSpectrum, previousRms, lastBeatTime);
      setPreviousRms(energyAndRmsResult.rms); // Update with the new smoothed RMS

      let newTimestamps = beatTimestamps; // Use local state beatTimestamps
      if (energyAndRmsResult.newBeat) {
          const currentTime = performance.now();
          setLastBeatTime(currentTime); // Update local state lastBeatTime
          newTimestamps = [...beatTimestamps, currentTime].slice(-20); // Use local beatTimestamps
          setBeatTimestamps(newTimestamps); // Update local beatTimestamps
      }
      calculatedBpm = estimateBPM(newTimestamps, currentGlobalAudioData.bpm);
      finalSpectrumToSet = currentSpectrum;
    }

    setAudioData({
      spectrum: finalSpectrumToSet,
      bassEnergy: energyAndRmsResult.bassEnergy,
      midEnergy: energyAndRmsResult.midEnergy,
      trebleEnergy: energyAndRmsResult.trebleEnergy,
      rms: energyAndRmsResult.rms,
      beat: energyAndRmsResult.newBeat,
      bpm: calculatedBpm,
    });

    // AGC Logic
    if (settings.enableAgc && gainNodeRef.current && audioContextRef.current && audioContextRef.current.state === 'running') {
        const currentRmsForAgc = energyAndRmsResult.rms; // Use the just calculated RMS
        const currentGain = gainNodeRef.current.gain.value;
        if (currentRmsForAgc > 0.005) { // Avoid division by zero or extreme gain changes in silence
            let targetGain = currentGain * (AGC_TARGET_RMS / currentRmsForAgc);
            targetGain = Math.max(AGC_MIN_GAIN, Math.min(AGC_MAX_GAIN, targetGain));
            const timeConstant = currentRmsForAgc > AGC_TARGET_RMS ? AGC_ATTACK_TIME_CONSTANT : AGC_RELEASE_TIME_CONSTANT;
            gainNodeRef.current.gain.setTargetAtTime(targetGain, audioContextRef.current.currentTime, timeConstant);
        } else if (currentGain > 1.5) { // If silent but gain is high, gently reduce it
            gainNodeRef.current.gain.setTargetAtTime(1.0, audioContextRef.current.currentTime, AGC_RELEASE_TIME_CONSTANT * 2 ); // Slower release
        }
    }
    localAnalysisLoopFrameIdRef.current = requestAnimationFrame(analyze);
  }, [
      settings.enableAgc, // settings from useSettings()
      calculateEnergy, estimateBPM,
      setAudioData, currentGlobalAudioData.bpm, // from useAudioData()
      // Local state and setters for beat detection and RMS smoothing:
      previousRms, lastBeatTime, beatTimestamps, 
      // setPreviousRms, setLastBeatTime, setBeatTimestamps are implicitly stable from useState
  ]);

  // Effect to manage manual gain changes
  useEffect(() => {
    if (isInitializedInternal && gainNodeRef.current && audioContextRef.current && audioContextRef.current.state === 'running') {
      if (!settings.enableAgc) { // Only apply manual gain if AGC is off
        gainNodeRef.current.gain.setTargetAtTime(settings.gain, audioContextRef.current.currentTime, 0.05); // Smooth transition
      }
    }
  }, [isInitializedInternal, settings.gain, settings.enableAgc]); // Re-run if these change

  // Effect to manage FFT size changes
  useEffect(() => {
    if (analyserRef.current && isInitializedInternal) {
      if (settings.fftSize !== analyserRef.current.fftSize) {
        analyserRef.current.fftSize = settings.fftSize;
        const newFrequencyBinCount = analyserRef.current.frequencyBinCount;
        dataArrayRef.current = new Uint8Array(newFrequencyBinCount);
        setAudioData(prev => ({ ...prev, spectrum: new Uint8Array(newFrequencyBinCount).fill(0) }));
        console.log("Analyser fftSize updated to:", settings.fftSize, "New frequencyBinCount:", newFrequencyBinCount);
      }
    }
  }, [isInitializedInternal, settings.fftSize, setAudioData]); // Re-run if these change

  // Effect to start/stop the analysis loop based on initialization and context state
  useEffect(() => {
    if (isInitializedInternal && audioContextRef.current && audioContextRef.current.state === 'running') {
      console.log("Starting audio analysis loop (from isInitialized/context state effect).");
      localAnalysisLoopFrameIdRef.current = requestAnimationFrame(analyze);
    } else {
      console.log("Condition not met for starting audio analysis loop or loop needs to stop.");
      if (localAnalysisLoopFrameIdRef.current) {
        cancelAnimationFrame(localAnalysisLoopFrameIdRef.current);
        localAnalysisLoopFrameIdRef.current = null;
      }
    }
    return () => {
      console.log("Cleanup for isInitialized/context state effect. Clearing localAnalysisLoopFrameIdRef:", localAnalysisLoopFrameIdRef.current);
      if (localAnalysisLoopFrameIdRef.current) {
        cancelAnimationFrame(localAnalysisLoopFrameIdRef.current);
        localAnalysisLoopFrameIdRef.current = null;
      }
    };
  }, [isInitializedInternal, analyze]);


  // FINAL Cleanup effect: This runs ONLY when the component using this hook unmounts.
  useEffect(() => {
    return () => {
      console.log("useAudioAnalysis hook is UNMOUNTING, calling stopAudioAnalysis for final cleanup.");
      stopAudioAnalysis();
    };
  }, [stopAudioAnalysis]); // CRITICAL: stopAudioAnalysis MUST be stable for this to work as intended.

  return { initializeAudio, stopAudioAnalysis, isInitialized: isInitializedInternal, error: errorInternal };
}
