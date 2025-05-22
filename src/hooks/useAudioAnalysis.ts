
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import type { AudioData } from '@/types';
import { useAudioData } from '@/providers/AudioDataProvider';
import { useSettings } from '@/providers/SettingsProvider';
import { INITIAL_AUDIO_DATA, DEFAULT_SETTINGS } from '@/lib/constants';

// Beat Detection Parameters
const BEAT_DETECTION_BASS_THRESHOLD = 0.15;
const BEAT_DETECTION_RMS_INCREASE_FACTOR = 1.08;
const BEAT_DETECTION_RMS_MIN_THRESHOLD = 0.03;
const BEAT_REFRACTORY_BASS_MS = 80;
const BEAT_REFRACTORY_RMS_MS = 60;

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
  const animationFrameIdRef = useRef<number | null>(null);

  const [isInitialized, setIsInitializedInternal] = useState(false);
  const [error, setErrorInternal] = useState<string | null>(null);

  const [lastBeatTime, setLastBeatTime] = useState(0);
  const [beatTimestamps, setBeatTimestamps] = useState<number[]>([]);
  const [previousRms, setPreviousRms] = useState(0);

  // Stable state setters
  const setIsInitialized = useCallback((val: boolean) => {
    console.log(`setIsInitialized called with: ${val}. Previous isInitialized: ${isInitializedInternal}`);
    setIsInitializedInternal(val);
  }, [isInitializedInternal]);

  const setError = useCallback((val: string | null) => {
    console.log(`setError called with: ${val}`);
    setErrorInternal(val);
  }, []);


  const stopAudioAnalysis = useCallback(async () => {
    console.log("stopAudioAnalysis called.");

    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
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
    analyserRef.current = null;
    dataArrayRef.current = null;

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
      console.log("MediaStream tracks stopped and stream released by stopAudioAnalysis.");
    }

    if (audioContextRef.current) {
      if (audioContextRef.current.state !== 'closed') {
        try {
          await audioContextRef.current.close();
          console.log("AudioContext closed by stopAudioAnalysis.");
        } catch (e) {
          console.error("Error closing audio context in stopAudioAnalysis", e);
        }
      }
      audioContextRef.current = null;
    }

    setIsInitialized(false);
    setAudioData(INITIAL_AUDIO_DATA);
    setError(null); // Clear any existing error on explicit stop
    setPreviousRms(0);
    setLastBeatTime(0);
    setBeatTimestamps([]);
    console.log("Audio analysis fully stopped and state reset by stopAudioAnalysis.");
  }, [setAudioData, setIsInitialized, setError]);


  const calculateEnergy = useCallback((spectrum: Uint8Array, currentRmsSmoothed: number, currentLastBeatTime: number): Pick<AudioData, 'bassEnergy' | 'midEnergy' | 'trebleEnergy' | 'rms'> & { newBeat: boolean } => {
    if (!audioContextRef.current || spectrum.length === 0) { // Check audioContextRef as well
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
        (bassEnergy > BEAT_DETECTION_BASS_THRESHOLD && bassEnergy > midEnergy && currentTime - currentLastBeatTime > BEAT_REFRACTORY_BASS_MS) ||
        (rms > currentRmsSmoothed * BEAT_DETECTION_RMS_INCREASE_FACTOR && rms > BEAT_DETECTION_RMS_MIN_THRESHOLD && currentTime - currentLastBeatTime > BEAT_REFRACTORY_RMS_MS)
    ) {
      newBeat = true;
    }
    return { bassEnergy, midEnergy, trebleEnergy, rms, newBeat };
  }, []); // No frequently changing dependencies

  const estimateBPM = useCallback((currentBeatTimestamps: number[], currentGlobalBpm: number): number => {
    if (currentBeatTimestamps.length < 5) return currentGlobalBpm || 120;
    const intervals = [];
    for (let i = 1; i < currentBeatTimestamps.length; i++) {
      intervals.push(currentBeatTimestamps[i] - currentBeatTimestamps[i-1]);
    }
    if (intervals.length === 0) return currentGlobalBpm || 120;
    intervals.sort((a, b) => a - b);
    const medianInterval = intervals[Math.floor(intervals.length / 2)];
    if (medianInterval === 0 || medianInterval < 50 ) return currentGlobalBpm || 120;
    const bpm = 60000 / medianInterval;
    const smoothedBpm = Math.round(currentGlobalBpm * 0.8 + bpm * 0.2);
    return smoothedBpm > 0 ? smoothedBpm : 120;
  }, []); // No frequently changing dependencies

  const analyze = useCallback(() => {
    if (!analyserRef.current || !dataArrayRef.current || !audioContextRef.current || !isInitializedInternal) {
      return;
    }

    analyserRef.current.getByteFrequencyData(dataArrayRef.current);
    const capturedSpectrum = new Uint8Array(dataArrayRef.current);
    const capturedSpectrumSum = capturedSpectrum.reduce((a, b) => a + b, 0);

    // console.log(
    //     '[RAW Audio Data] Sum:', capturedSpectrumSum,
    //     'Bins (first 5):', Array.from(capturedSpectrum.slice(0,5)),
    //     'Manual Gain Setting:', settings.gain,
    //     'Actual GainNode Value:', gainNodeRef.current?.gain.value.toFixed(3)
    // );

    let energyAndRmsResult: Pick<AudioData, 'bassEnergy' | 'midEnergy' | 'trebleEnergy' | 'rms'> & { newBeat: boolean };
    let calculatedBpm: number;
    let finalSpectrumToSet: Uint8Array;

    if (capturedSpectrumSum < EFFECTIVE_SILENCE_THRESHOLD_SUM) {
      energyAndRmsResult = { bassEnergy: 0, midEnergy: 0, trebleEnergy: 0, rms: 0, newBeat: false };
      calculatedBpm = currentGlobalAudioData.bpm;
      finalSpectrumToSet = new Uint8Array(capturedSpectrum.length).fill(0);
      setPreviousRms(0);
    } else {
      energyAndRmsResult = calculateEnergy(capturedSpectrum, previousRms, lastBeatTime);
      setPreviousRms(energyAndRmsResult.rms);

      if (energyAndRmsResult.newBeat) {
          const currentTime = performance.now();
          setLastBeatTime(currentTime);
          setBeatTimestamps(prev => {
              const newTimestamps = [...prev, currentTime].slice(-20);
              calculatedBpm = estimateBPM(newTimestamps, currentGlobalAudioData.bpm);
              return newTimestamps;
          });
      } else {
          calculatedBpm = estimateBPM(beatTimestamps, currentGlobalAudioData.bpm);
      }
      finalSpectrumToSet = capturedSpectrum;
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

    if (settings.enableAgc && gainNodeRef.current && audioContextRef.current && audioContextRef.current.state === 'running') {
        const currentRmsForAgc = energyAndRmsResult.rms;
        const currentGain = gainNodeRef.current.gain.value;
        if (currentRmsForAgc > 0.005) {
            let targetGain = currentGain * (AGC_TARGET_RMS / currentRmsForAgc);
            targetGain = Math.max(AGC_MIN_GAIN, Math.min(AGC_MAX_GAIN, targetGain));
            const timeConstant = currentRmsForAgc > AGC_TARGET_RMS ? AGC_ATTACK_TIME_CONSTANT : AGC_RELEASE_TIME_CONSTANT;
            gainNodeRef.current.gain.setTargetAtTime(targetGain, audioContextRef.current.currentTime, timeConstant);
        } else if (currentGain > 1.5) {
            gainNodeRef.current.gain.setTargetAtTime(1.0, audioContextRef.current.currentTime, AGC_RELEASE_TIME_CONSTANT * 2 );
        }
    }
  }, [
      isInitializedInternal,
      settings.gain, settings.enableAgc,
      calculateEnergy, estimateBPM,
      setAudioData, currentGlobalAudioData.bpm,
      previousRms, lastBeatTime, beatTimestamps
  ]);

  const initializeAudio = useCallback(async () => {
    console.log("initializeAudio called.");
    setError(null);

    if (isInitializedInternal && audioContextRef.current && audioContextRef.current.state === 'running') {
      console.log("Audio seems already initialized and running. Aborting.");
      return;
    }
    
    console.log("initializeAudio: Performing cleanup of any existing audio resources first.");
    await stopAudioAnalysis(); 
    console.log("initializeAudio: Cleanup finished.");

    setLastBeatTime(0);
    setBeatTimestamps([]);
    setPreviousRms(0);

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

      analyserRef.current.fftSize = settings.fftSize;
      console.log("Analyser fftSize set to:", settings.fftSize, "Resulting frequencyBinCount:", analyserRef.current.frequencyBinCount);
      analyserRef.current.smoothingTimeConstant = 0.3;
      dataArrayRef.current = new Uint8Array(analyserRef.current.frequencyBinCount);

      sourceNodeRef.current.connect(gainNodeRef.current);
      gainNodeRef.current.connect(analyserRef.current);

      if (settings.enableAgc) {
        gainNodeRef.current.gain.setValueAtTime(1.0, newAudioContext.currentTime);
      } else {
        gainNodeRef.current.gain.setValueAtTime(settings.gain, newAudioContext.currentTime);
      }

      setIsInitialized(true);
      setError(null);
    } catch (err) {
      console.error("Error initializing audio:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      setIsInitialized(false);
      await stopAudioAnalysis(); // Ensure full cleanup on error
    }
  }, [settings.fftSize, settings.gain, settings.enableAgc, stopAudioAnalysis, setIsInitialized, setError, setAudioData]); // Dependencies are mostly stable or settings

  useEffect(() => {
    if (isInitializedInternal && gainNodeRef.current && audioContextRef.current && audioContextRef.current.state === 'running') {
      if (!settings.enableAgc) {
        gainNodeRef.current.gain.setTargetAtTime(settings.gain, audioContextRef.current.currentTime, 0.05);
      }
    }
  }, [isInitializedInternal, settings.gain, settings.enableAgc]);

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
  }, [isInitializedInternal, settings.fftSize, setAudioData]);

  useEffect(() => {
    if (isInitializedInternal && audioContextRef.current && audioContextRef.current.state === 'running') {
      console.log("Starting audio analysis loop because isInitializedInternal is true.");
      animationFrameIdRef.current = requestAnimationFrame(function Mloop() { // Named loop for clarity
        if (isInitializedInternal && audioContextRef.current && audioContextRef.current.state === 'running') {
          analyze();
          animationFrameIdRef.current = requestAnimationFrame(Mloop);
        } else {
            if(animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
            animationFrameIdRef.current = null;
        }
      });
    } else {
      console.log("Stopping audio analysis loop because isInitializedInternal is false or context not running.");
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
    }
    return () => {
      console.log("Cleanup for analyze loop effect (isInitializedInternal or analyze changed). animationFrameIdRef:", animationFrameIdRef.current);
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
    };
  }, [isInitializedInternal, analyze]);

  useEffect(() => {
    // This is the crucial unmount effect for the hook.
    // It MUST have an empty dependency array to ensure it only runs on true unmount.
    return () => {
      console.log("useAudioAnalysis hook is UNMOUNTING. Calling stopAudioAnalysis for final cleanup.");
      // We need to call the latest version of stopAudioAnalysis.
      // Since stopAudioAnalysis is a useCallback with stable dependencies, this should be fine.
      // However, to be absolutely safe against stale closures if this cleanup runs late,
      // one might consider a ref for stopAudioAnalysis if it were more complex.
      // For now, direct call is okay as its deps are stable setters.
      stopAudioAnalysis();
    };
  }, []); // EMPTY DEPENDENCY ARRAY

  return { initializeAudio, stopAudioAnalysis, isInitialized: isInitializedInternal, error: errorInternal };
}
