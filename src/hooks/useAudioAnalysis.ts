
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import type { AudioData } from '@/types';
import { useAudioData } from '@/providers/AudioDataProvider';
import { useSettings } from '@/providers/SettingsProvider';
import { INITIAL_AUDIO_DATA, DEFAULT_SETTINGS } from '@/lib/constants';

// Beat Detection Parameters
const BEAT_DETECTION_BASS_THRESHOLD = 0.15; // Lowered for more sensitivity
const BEAT_DETECTION_RMS_INCREASE_FACTOR = 1.08; // Slightly more sensitive
const BEAT_DETECTION_RMS_MIN_THRESHOLD = 0.03; // Lowered
const BEAT_REFRACTORY_BASS_MS = 80; // Slightly shorter
const BEAT_REFRACTORY_RMS_MS = 60;  // Slightly shorter

const RMS_SMOOTHING_FACTOR = 0.1;

// AGC Constants
const AGC_TARGET_RMS = 0.25;
const AGC_MIN_GAIN = 0.1;
const AGC_MAX_GAIN = 4.0;
const AGC_ATTACK_TIME_CONSTANT = 0.03;
const AGC_RELEASE_TIME_CONSTANT = 0.4;

const EFFECTIVE_SILENCE_THRESHOLD_SUM = 5; // If sum of all spectrum bins is less than this, consider it silence.

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
    const bassEndFreq = 250;
    const midEndFreq = 4000;

    const spectrumLength = spectrum.length > 0 ? spectrum.length : DEFAULT_SETTINGS.fftSize / 2; // Use default if spectrum is empty (e.g. during silence)

    const bassBins = Math.floor((bassEndFreq / nyquist) * spectrumLength);
    const midBins = Math.floor((midEndFreq / nyquist) * spectrumLength);

    let bassSum = 0;
    for (let i = 0; i < bassBins; i++) {
      bassSum += spectrum[i] || 0;
    }
    const bassEnergy = bassBins > 0 ? (bassSum / bassBins) / 255 : 0;

    let midSum = 0;
    for (let i = bassBins; i < midBins; i++) {
      midSum += spectrum[i] || 0;
    }
    const midEnergy = (midBins - bassBins) > 0 ? (midSum / (midBins - bassBins)) / 255 : 0;

    let trebleSum = 0;
    for (let i = midBins; i < spectrumLength; i++) {
      trebleSum += spectrum[i] || 0;
    }
    const trebleEnergy = (spectrumLength - midBins) > 0 ? (trebleSum / (spectrumLength - midBins)) / 255 : 0;

    let sumOfSquares = 0;
    for (let i = 0; i < spectrumLength; i++) {
      sumOfSquares += ((spectrum[i] || 0) / 255) * ((spectrum[i] || 0) / 255);
    }
    let rms = Math.sqrt(sumOfSquares / spectrumLength);
    rms = previousRms + (rms - previousRms) * RMS_SMOOTHING_FACTOR;
    setPreviousRms(rms);


    let beat = false;
    const currentTime = performance.now();
     if (
        (bassEnergy > BEAT_DETECTION_BASS_THRESHOLD && bassEnergy > midEnergy && currentTime - lastBeatTime > BEAT_REFRACTORY_BASS_MS) ||
        (rms > previousRms * BEAT_DETECTION_RMS_INCREASE_FACTOR && rms > BEAT_DETECTION_RMS_MIN_THRESHOLD && currentTime - lastBeatTime > BEAT_REFRACTORY_RMS_MS)
    ) {
      beat = true;
      setLastBeatTime(currentTime);
      setBeatTimestamps(prev => {
        const newTimestamps = [...prev, currentTime].slice(-20);
        return newTimestamps;
      });
    }

    return { bassEnergy, midEnergy, trebleEnergy, rms, beat };
  }, [previousRms, lastBeatTime]); // Removed audioContextRef.current from dependencies as it's a ref

  const estimateBPM = useCallback((): number => {
    if (beatTimestamps.length < 5) return currentGlobalAudioData.bpm || 120;

    const intervals = [];
    for (let i = 1; i < beatTimestamps.length; i++) {
      intervals.push(beatTimestamps[i] - beatTimestamps[i-1]);
    }

    if (intervals.length === 0) return currentGlobalAudioData.bpm || 120;

    intervals.sort((a, b) => a - b);
    const medianInterval = intervals[Math.floor(intervals.length / 2)];

    if (medianInterval === 0 || medianInterval < 50 ) return currentGlobalAudioData.bpm || 120; // Avoid division by zero or unrealistically low intervals

    const bpm = 60000 / medianInterval;
    const smoothedBpm = Math.round(currentGlobalAudioData.bpm * 0.8 + bpm * 0.2); // Apply smoothing
    return smoothedBpm > 0 ? smoothedBpm : 120; // Ensure BPM is positive
  }, [beatTimestamps, currentGlobalAudioData.bpm]);

  const analyze = useCallback(() => {
    if (!analyserRef.current || !dataArrayRef.current || !audioContextRef.current || !isInitialized) {
      if (isInitialized && audioContextRef.current && audioContextRef.current.state === 'running') {
         animationFrameIdRef.current = requestAnimationFrame(analyze);
      }
      return;
    }

    analyserRef.current.getByteFrequencyData(dataArrayRef.current);
    const currentSpectrum = new Uint8Array(dataArrayRef.current); // Copy for processing
    const spectrumSum = currentSpectrum.reduce((a, b) => a + b, 0);

    // Log raw data BEFORE thresholding
    console.log(
        '[RAW Audio Data] Sum:', spectrumSum,
        'Bins (first 5):', Array.from(currentSpectrum.slice(0,5)),
        'Manual Gain Setting:', settings.gain,
        'Actual GainNode Value:', gainNodeRef.current?.gain.value.toFixed(3)
    );


    let energyAndRms: Pick<AudioData, 'bassEnergy' | 'midEnergy' | 'trebleEnergy' | 'rms' | 'beat'>;
    let bpm: number;
    let finalSpectrum: Uint8Array;

    if (spectrumSum < EFFECTIVE_SILENCE_THRESHOLD_SUM) {
      // Effective silence
      energyAndRms = { bassEnergy: 0, midEnergy: 0, trebleEnergy: 0, rms: 0, beat: false };
      bpm = currentGlobalAudioData.bpm; // Maintain last known BPM or default
      finalSpectrum = new Uint8Array(currentSpectrum.length).fill(0);
      setPreviousRms(0); // Reset smoothed RMS during silence
      // console.log('useAudioAnalysis - Effective Silence Detected. Sum:', spectrumSum);
    } else {
      // Active audio
      // console.log('useAudioAnalysis - Raw Spectrum has energy. Sum:', spectrumSum, 'First 5 bins:', currentSpectrum.slice(0,5));
      energyAndRms = calculateEnergy(currentSpectrum);
      bpm = estimateBPM();
      finalSpectrum = currentSpectrum;
    }

    setAudioData({
      spectrum: finalSpectrum,
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
  }, [settings.gain, settings.enableAgc, calculateEnergy, estimateBPM, setAudioData, isInitialized, currentGlobalAudioData.bpm]);


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
    if (analyserRef.current) { // Ensure analyserRef is also nulled
        analyserRef.current = null;
    }
    dataArrayRef.current = null; // Clear data array

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
  }, [isInitialized, setAudioData]);

  const initializeAudio = useCallback(async () => {
    console.log("initializeAudio called. Current state - isInitialized:", isInitialized, "AudioContext:", audioContextRef.current?.state);
    setError(null);

    if (isInitialized && audioContextRef.current && audioContextRef.current.state === 'running') {
      console.log("Audio already initialized and running. Aborting initializeAudio.");
      return;
    }

    // Comprehensive cleanup before re-initialization
    console.log("Performing cleanup before audio initialization...");
    await stopAudioAnalysis(); // Use the existing stop function for thorough cleanup
    console.log("Cleanup via stopAudioAnalysis finished.");

    // Reset local state for beat detection etc.
    setLastBeatTime(0);
    setBeatTimestamps([]);
    setPreviousRms(0);
    // setAudioData(INITIAL_AUDIO_DATA); // stopAudioAnalysis already does this


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
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      setIsInitialized(false);
      setAudioData(INITIAL_AUDIO_DATA);
      // Ensure cleanup happens on error too
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
  }, [isInitialized, settings.fftSize, settings.gain, settings.enableAgc, analyze, setAudioData, stopAudioAnalysis]);

  useEffect(() => {
    if (!isInitialized || !gainNodeRef.current || !audioContextRef.current || audioContextRef.current.state !== 'running') return;

    if (!settings.enableAgc) { // AGC logic is in analyze(), this handles manual gain
        gainNodeRef.current.gain.setTargetAtTime(
            settings.gain,
            audioContextRef.current.currentTime,
            0.05
        );
    }
  }, [settings.enableAgc, settings.gain, isInitialized]);

  useEffect(() => {
    if (!analyserRef.current || !isInitialized) return;

    if (settings.fftSize !== analyserRef.current.fftSize) {
      analyserRef.current.fftSize = settings.fftSize;
      const newFrequencyBinCount = analyserRef.current.frequencyBinCount;
      dataArrayRef.current = new Uint8Array(newFrequencyBinCount);
      setAudioData(prev => ({
        ...prev,
        spectrum: new Uint8Array(newFrequencyBinCount).fill(0)
      }));
    }
  }, [settings.fftSize, isInitialized, setAudioData]);


  useEffect(() => {
    // This effect starts the animation loop when isInitialized becomes true
    // and the audio context is running. It also handles stopping the loop
    // if isInitialized becomes false or if the audio context is not running.
    let localAnimationFrameId: number | null = null;

    if (isInitialized && audioContextRef.current && audioContextRef.current.state === 'running') {
      console.log("Starting audio analysis loop (from isInitialized/context state effect).");
      const loop = () => {
        analyze();
        localAnimationFrameId = requestAnimationFrame(loop);
      };
      localAnimationFrameId = requestAnimationFrame(loop);
    } else {
      console.log("Condition not met for starting audio analysis loop or loop needs to stop.");
      if (animationFrameIdRef.current) { // Clear the global ref if it exists
          cancelAnimationFrame(animationFrameIdRef.current);
          animationFrameIdRef.current = null;
          console.log("Cleared global animationFrameIdRef.");
      }
    }

    return () => {
      console.log("Cleanup for isInitialized/context state effect. Clearing localAnimationFrameId:", localAnimationFrameId);
      if (localAnimationFrameId) {
        cancelAnimationFrame(localAnimationFrameId);
      }
      // Ensure the global ref is also cleared if this effect is cleaning up
      if (animationFrameIdRef.current) {
          cancelAnimationFrame(animationFrameIdRef.current);
          animationFrameIdRef.current = null;
           console.log("Cleared global animationFrameIdRef during isInitialized/context state effect cleanup.");
      }
    };
  }, [isInitialized, analyze]); // analyze is a dependency


  useEffect(() => {
    // Main hook lifecycle cleanup: ensures audio is stopped when the component using this hook unmounts.
    return () => {
      console.log("useAudioAnalysis hook is unmounting, calling stopAudioAnalysis for final cleanup.");
      stopAudioAnalysis();
    };
  }, [stopAudioAnalysis]);


  return { initializeAudio, stopAudioAnalysis, isInitialized, error };
}

