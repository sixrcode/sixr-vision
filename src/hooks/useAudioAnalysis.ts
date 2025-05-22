
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import type { AudioData } from '@/types';
import { useAudioData } from '@/providers/AudioDataProvider';
import { useSettings } from '@/providers/SettingsProvider';
import { INITIAL_AUDIO_DATA } from '@/lib/constants';

// Beat Detection Parameters
const BEAT_DETECTION_BASS_THRESHOLD = 0.08;
const BEAT_DETECTION_RMS_INCREASE_FACTOR = 1.05;
const BEAT_DETECTION_RMS_MIN_THRESHOLD = 0.02;
const BEAT_REFRACTORY_BASS_MS = 50;
const BEAT_REFRACTORY_RMS_MS = 40;

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
  const animationFrameIdRef = useRef<number | null>(null); // For VisualizerView to potentially cancel
  const localAnalysisLoopFrameIdRef = useRef<number | null>(null); // For this hook's internal loop

  const [isInitializedInternal, setIsInitializedInternalActual] = useState(false);
  const [errorInternal, setErrorInternalActual] = useState<string | null>(null);

  // Refs to hold current values for logging inside stable callbacks
  const isInitializedInternalRef = useRef(isInitializedInternal);
  useEffect(() => {
    isInitializedInternalRef.current = isInitializedInternal;
  }, [isInitializedInternal]);

  const errorInternalRef = useRef(errorInternal);
  useEffect(() => {
    errorInternalRef.current = errorInternal;
  }, [errorInternal]);


  const setIsInitialized = useCallback((val: boolean) => {
    console.log(`setIsInitialized called with: ${val}. Previous isInitialized from ref: ${isInitializedInternalRef.current}`);
    setIsInitializedInternalActual(val);
  }, [setIsInitializedInternalActual]);

  const setError = useCallback((val: string | null) => {
    console.log(`setError called with: ${val}. Previous error from ref: ${errorInternalRef.current}`);
    setErrorInternalActual(val);
  }, [setErrorInternalActual]);


  const [lastBeatTime, setLastBeatTime] = useState(0);
  const [beatTimestamps, setBeatTimestamps] = useState<number[]>([]);
  const [previousRms, setPreviousRms] = useState(0);

  const stopAudioAnalysis = useCallback(async () => {
    console.log("stopAudioAnalysis called. Current state - isInitialized from ref:", isInitializedInternalRef.current);

    if (localAnalysisLoopFrameIdRef.current) {
      cancelAnimationFrame(localAnalysisLoopFrameIdRef.current);
      localAnalysisLoopFrameIdRef.current = null;
    }
    // Also ensure global ref is cleared if it was somehow set by an older version
    if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
    }
    console.log("Analysis loop stopped by stopAudioAnalysis.");

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
    setError(null);
    setPreviousRms(0);
    setLastBeatTime(0);
    setBeatTimestamps([]);
    console.log("Audio analysis stopped and state reset. isInitialized set to false.");
  }, [setAudioData, setIsInitialized, setError]); // Depends only on stable setters

  const initializeAudio = useCallback(async () => {
    console.log("initializeAudio called. Current state - isInitialized from ref:", isInitializedInternalRef.current, "AudioContext:", audioContextRef.current?.state);

    if (isInitializedInternalRef.current && audioContextRef.current && audioContextRef.current.state === 'running') {
      console.log("Audio seems already initialized and running. Aborting initializeAudio.");
      return;
    }

    console.log("Performing cleanup before audio initialization...");
    // Call stopAudioAnalysis directly, as it's now stable
    await stopAudioAnalysis();
    console.log("Cleanup via stopAudioAnalysis finished.");


    setError(null);

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
      console.log("Analyser fftSize set to:", analyserRef.current.fftSize, "Resulting frequencyBinCount:", analyserRef.current.frequencyBinCount);
      analyserRef.current.smoothingTimeConstant = 0.3;
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
      await stopAudioAnalysis();
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
        (rms > currentRmsSmoothed * BEAT_DETECTION_RMS_INCREASE_FACTOR && rms > BEAT_DETECTION_RMS_MIN_THRESHOLD && currentTime - currentLastBeatTime > BEAT_REFRACTORY_RMS_MS)
    ) {
      newBeat = true;
    }
    return { bassEnergy, midEnergy, trebleEnergy, rms, newBeat };
  }, []);

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
  }, []);

  const analyze = useCallback(() => {
    if (!analyserRef.current || !dataArrayRef.current || !audioContextRef.current || audioContextRef.current.state !== 'running' || !isInitializedInternalRef.current) {
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
      setPreviousRms(0);
    } else {
      energyAndRmsResult = calculateEnergy(currentSpectrum, previousRms, lastBeatTime);
      setPreviousRms(energyAndRmsResult.rms);

      let newTimestamps = beatTimestamps;
      if (energyAndRmsResult.newBeat) {
          const currentTime = performance.now();
          setLastBeatTime(currentTime);
          newTimestamps = [...beatTimestamps, currentTime].slice(-20);
          setBeatTimestamps(newTimestamps);
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
      settings.enableAgc, settings.gain,
      calculateEnergy, estimateBPM,
      setAudioData, currentGlobalAudioData.bpm,
      previousRms, lastBeatTime, beatTimestamps
  ]);

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
    const loop = () => {
      if (isInitializedInternal && audioContextRef.current && audioContextRef.current.state === 'running' && analyserRef.current && dataArrayRef.current) {
        analyze();
        localAnalysisLoopFrameIdRef.current = requestAnimationFrame(loop);
      } else {
        if (localAnalysisLoopFrameIdRef.current) {
          cancelAnimationFrame(localAnalysisLoopFrameIdRef.current);
          localAnalysisLoopFrameIdRef.current = null;
        }
      }
    };

    if (isInitializedInternal && audioContextRef.current && audioContextRef.current.state === 'running') {
      console.log("Starting audio analysis loop.");
      localAnalysisLoopFrameIdRef.current = requestAnimationFrame(loop);
    } else {
      console.log("Condition not met for starting audio analysis loop or loop needs to stop.");
      if (localAnalysisLoopFrameIdRef.current) {
        cancelAnimationFrame(localAnalysisLoopFrameIdRef.current);
        localAnalysisLoopFrameIdRef.current = null;
      }
    }

    return () => {
      console.log("Cleanup for isInitializedInternal/analyze effect. Clearing localAnalysisLoopFrameIdRef:", localAnalysisLoopFrameIdRef.current);
      if (localAnalysisLoopFrameIdRef.current) {
        cancelAnimationFrame(localAnalysisLoopFrameIdRef.current);
        localAnalysisLoopFrameIdRef.current = null;
      }
    };
  }, [isInitializedInternal, analyze]);

  useEffect(() => {
    // This is the TRUE unmount effect for the hook instance.
    // It should only run when the component using this hook is actually removed from the tree.
    return () => {
      console.log("useAudioAnalysis hook is UNMOUNTING (final cleanup), calling stopAudioAnalysis.");
      // stopAudioAnalysis is now stable and can be called here.
      stopAudioAnalysis();
    };
  }, [stopAudioAnalysis]); // CRITICAL: Ensure stopAudioAnalysis is stable (which it is now)

  return { initializeAudio, stopAudioAnalysis, isInitialized: isInitializedInternal, error: errorInternal };
}

