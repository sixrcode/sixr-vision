
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import type { AudioData, Settings } from '@/types';
import { useAudioData } from '@/providers/AudioDataProvider';
import { useSettings } from '@/providers/SettingsProvider';
import { INITIAL_AUDIO_DATA } from '@/lib/constants';

// Beat Detection Parameters
const BEAT_DETECTION_BASS_THRESHOLD = 0.05;
const BEAT_DETECTION_RMS_INCREASE_FACTOR = 1.03;
const BEAT_DETECTION_RMS_MIN_THRESHOLD = 0.015;
const BEAT_REFRACTORY_BASS_MS = 30;
const BEAT_REFRACTORY_RMS_MS = 20;

const RMS_SMOOTHING_FACTOR = 0.1;

// AGC Constants
const AGC_TARGET_RMS = 0.25;
const AGC_MIN_GAIN = 0.1;
const AGC_MAX_GAIN = 4.0;
const AGC_ATTACK_TIME_CONSTANT = 0.03;
const AGC_RELEASE_TIME_CONSTANT = 0.4;

const EFFECTIVE_SILENCE_THRESHOLD_SUM = 15; // Sum of all spectrum bins; if below this, considered silence.

/**
 * @fileOverview This hook manages the entire audio analysis pipeline for the SIXR Vision application.
 * It handles microphone input, FFT analysis, beat detection, RMS calculation, BPM estimation,
 * and Automatic Gain Control (AGC).
 *
 * @exports useAudioAnalysis - The main hook function.
 * @returns {object} An object containing:
 *  - initializeAudio: Function to start audio capture and analysis.
 *  - stopAudioAnalysis: Function to stop audio capture and analysis.
 *  - isInitialized: Boolean indicating if the audio pipeline is active.
 *  - error: String containing an error message if initialization failed, otherwise null.
 *  - audioInputDevices: An array of MediaDeviceInfo objects for available audio input devices.
 */
export function useAudioAnalysis() {
  const { settings } = useSettings();
  const settingsRef = useRef(settings);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const { audioData: currentGlobalAudioData, setAudioData } = useAudioData();

  const [isInitializedInternalActual, setIsInitializedInternalActual] = useState(false);
  const [errorInternalActual, setErrorInternalActual] = useState<string | null>(null);
  const [audioInputDevices, setAudioInputDevices] = useState<MediaDeviceInfo[]>([]);

  const isInitializedInternalRef = useRef(isInitializedInternalActual);
   useEffect(() => {
    isInitializedInternalRef.current = isInitializedInternalActual;
  }, [isInitializedInternalActual]);

  const errorInternalRef = useRef(errorInternalActual);
   useEffect(() => {
    errorInternalRef.current = errorInternalActual;
  }, [errorInternalActual]);


  /**
   * Updates the internal 'isInitialized' state and logs the change.
   * @param {boolean} val - The new initialization state.
   */
  const setIsInitialized = useCallback((val: boolean) => {
    console.log(`setIsInitialized called with: ${val}. Previous isInitialized: ${isInitializedInternalRef.current}`);
    setIsInitializedInternalActual(val);
  }, []); // Dependency array is empty as setIsInitializedInternalActual is stable from useState

  /**
   * Updates the internal 'error' state and logs the change.
   * @param {string | null} val - The new error message, or null if no error.
   */
  const setError = useCallback((val: string | null) => {
    console.log(`setError called with: ${val}. Previous error: ${errorInternalRef.current}`);
    setErrorInternalActual(val);
  }, []); // Dependency array is empty as setErrorInternalActual is stable from useState


  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const localAnalysisLoopFrameIdRef = useRef<number | null>(null);

  const lastBeatTimeRef = useRef(0);
  const beatTimestampsRef = useRef<number[]>([]);
  const previousRmsRef = useRef(0);


  /**
   * Stops audio capture and analysis, releasing microphone access and cleaning up AudioContext resources.
   * Resets audio data to initial values.
   * @async
   */
  const stopAudioAnalysis = useCallback(async () => {
    console.log("stopAudioAnalysis called. Current state - isInitializedInternalActual:", isInitializedInternalRef.current);
    if (!isInitializedInternalRef.current && (!audioContextRef.current && !mediaStreamRef.current)) {
        console.log("Audio not initialized or already stopped. Aborting stopAudioAnalysis.");
        return;
    }

    if (localAnalysisLoopFrameIdRef.current) {
      cancelAnimationFrame(localAnalysisLoopFrameIdRef.current);
      localAnalysisLoopFrameIdRef.current = null;
      console.log("Analysis loop stopped by stopAudioAnalysis.");
    }

    if (gainNodeRef.current && audioContextRef.current && audioContextRef.current.destination) {
        try { gainNodeRef.current.disconnect(audioContextRef.current.destination); } catch (e) { console.warn("Error disconnecting gainNode from destination", e); }
    }
    if (sourceNodeRef.current) {
        if (gainNodeRef.current) {
            try { sourceNodeRef.current.disconnect(gainNodeRef.current); } catch (e) { console.warn("Error disconnecting sourceNodeRef from gainNodeRef", e); }
        }
        if(analyserRef.current && gainNodeRef.current === null) {
            try { sourceNodeRef.current.disconnect(analyserRef.current); } catch(e) {console.warn("Error disconnecting sourceNodeRef from analyserRef", e);}
        }
        sourceNodeRef.current.disconnect();
        sourceNodeRef.current = null;
    }
    if (gainNodeRef.current) {
        if(analyserRef.current) {
            try { gainNodeRef.current.disconnect(analyserRef.current); } catch (e) { console.warn("Error disconnecting gainNodeRef from analyserRef", e); }
        }
        gainNodeRef.current.disconnect();
        gainNodeRef.current = null;
    }
    if (analyserRef.current) {
        analyserRef.current.disconnect();
        analyserRef.current = null;
    }
    
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
    previousRmsRef.current = 0;
    lastBeatTimeRef.current = 0;
    beatTimestampsRef.current = [];
    console.log("Audio analysis stopped and state reset. isInitialized set to false.");
  }, [setAudioData, setIsInitialized, setError]);


  /**
   * Initializes audio capture and analysis.
   * Requests microphone permission, sets up AudioContext, AnalyserNode, and GainNode.
   * Starts the audio analysis loop if successful.
   * @async
   */
  const initializeAudio = useCallback(async () => {
    console.log("initializeAudio called. Current state - isInitializedInternalActual:", isInitializedInternalRef.current, "AudioContext state:", audioContextRef.current?.state);
    
    if (isInitializedInternalRef.current || audioContextRef.current) {
      console.log("Performing cleanup before audio re-initialization...");
      await stopAudioAnalysis(); 
      console.log("Cleanup via stopAudioAnalysis finished before re-init.");
    }
    
    setError(null); 

    try {
      console.log("Enumerating audio input devices...");
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(device => device.kind === 'audioinput');
      setAudioInputDevices(audioInputs); 

      if (audioInputs.length > 0) {
        console.log("Available audio input devices:");
        audioInputs.forEach((device, i) => {
          console.log(`  Device ${i}: Label: ${device.label || 'No label'}, ID: ${device.deviceId}`);
        });
      } else {
        console.log("No audio input devices found.");
      }
      
      const audioConstraints: MediaTrackConstraints = {};
      if (settingsRef.current.selectedAudioInputDeviceId && audioInputs.some(d => d.deviceId === settingsRef.current.selectedAudioInputDeviceId)) {
        audioConstraints.deviceId = { exact: settingsRef.current.selectedAudioInputDeviceId };
        console.log("Attempting to use selected deviceId:", settingsRef.current.selectedAudioInputDeviceId);
      } else {
        console.log("No specific deviceId selected or selection invalid, using default audio input.");
      }

      console.log("Requesting microphone access with constraints:", audioConstraints);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints, video: false });
      mediaStreamRef.current = stream;
      console.log("Microphone access granted.");

      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length > 0) {
        const selectedTrack = audioTracks[0];
        console.log(`Selected Audio Track Label: ${selectedTrack.label || 'No label'}`);
        console.log("Selected Audio Track Settings:", JSON.stringify(selectedTrack.getSettings(), null, 2));
      } else {
        console.warn("No audio tracks found in the obtained stream.");
        throw new Error("No audio tracks available in the microphone stream.");
      }

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

      console.log("Analyser fftSize will be set to:", settingsRef.current.fftSize);
      analyserRef.current.fftSize = settingsRef.current.fftSize;
      analyserRef.current.smoothingTimeConstant = 0.3; 
      console.log("Analyser fftSize set to:", analyserRef.current.fftSize, "Resulting frequencyBinCount:", analyserRef.current.frequencyBinCount);
      dataArrayRef.current = new Uint8Array(analyserRef.current.frequencyBinCount);

      sourceNodeRef.current.connect(gainNodeRef.current);
      gainNodeRef.current.connect(analyserRef.current);

      if (settingsRef.current.monitorAudio && gainNodeRef.current && newAudioContext.destination) {
        gainNodeRef.current.connect(newAudioContext.destination);
        console.log("Audio monitoring enabled: GainNode connected to destination.");
      }

      if (settingsRef.current.enableAgc && gainNodeRef.current) {
        gainNodeRef.current.gain.setValueAtTime(1.0, newAudioContext.currentTime);
      } else if (gainNodeRef.current) {
        gainNodeRef.current.gain.setValueAtTime(settingsRef.current.gain, newAudioContext.currentTime);
      }
      if (gainNodeRef.current) console.log("GainNode initial value set to:", gainNodeRef.current.gain.value);

      setIsInitialized(true);
      setError(null); 
      console.log("Audio initialized successfully. isInitialized set to true.");

    } catch (err) {
      console.error("Error initializing audio:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      setIsInitialized(false);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        try { await audioContextRef.current.close(); } catch(e) { console.warn("Error closing audio context during init failure cleanup", e); }
        audioContextRef.current = null;
      }
    }
  }, [stopAudioAnalysis, setIsInitialized, setError, setAudioInputDevices]); // settingsRef is stable (ref)


  /**
   * Calculates audio energy (bass, mid, treble, RMS) and detects beats from spectrum data.
   * @param {Uint8Array} spectrum - The raw frequency spectrum data.
   * @param {number} currentRmsForCalc - The previous RMS value for smoothing.
   * @param {number} currentLastBeatTime - Timestamp of the last detected beat.
   * @param {number} currentPreviousRms - The RMS value from the immediately preceding frame.
   * @returns {object} An object containing bassEnergy, midEnergy, trebleEnergy, rms, and newBeat (boolean).
   */
  const calculateEnergy = useCallback((
    spectrum: Uint8Array,
    currentRmsForCalc: number,
    currentLastBeatTime: number,
    currentPreviousRms: number
  ): Pick<AudioData, 'bassEnergy' | 'midEnergy' | 'trebleEnergy' | 'rms'> & { newBeat: boolean } => {
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
    let rms = currentRmsForCalc + (rmsRaw - currentRmsForCalc) * RMS_SMOOTHING_FACTOR;

    let newBeat = false;
    const currentTime = performance.now();
     if (
        (bassEnergy > BEAT_DETECTION_BASS_THRESHOLD && currentTime - currentLastBeatTime > BEAT_REFRACTORY_BASS_MS) ||
        (rms > currentPreviousRms * BEAT_DETECTION_RMS_INCREASE_FACTOR && rms > BEAT_DETECTION_RMS_MIN_THRESHOLD && currentTime - currentLastBeatTime > BEAT_REFRACTORY_RMS_MS)
    ) {
      newBeat = true;
    }
    return { bassEnergy, midEnergy, trebleEnergy, rms, newBeat };
  }, []); // Depends only on audioContextRef (stable)

  /**
   * Estimates Beats Per Minute (BPM) from a series of beat timestamps.
   * @param {number[]} currentBeatTs - Array of recent beat timestamps.
   * @param {number} currentBpm - The current BPM value for smoothing.
   * @returns {number} The estimated BPM.
   */
  const estimateBPM = useCallback((currentBeatTs: number[], currentBpm: number): number => {
    if (currentBeatTs.length < 5) return currentBpm || 120;
    const intervals = [];
    for (let i = 1; i < currentBeatTs.length; i++) {
      intervals.push(currentBeatTs[i] - currentBeatTs[i-1]);
    }
    if (intervals.length === 0) return currentBpm || 120;
    intervals.sort((a, b) => a - b);
    const medianInterval = intervals[Math.floor(intervals.length / 2)];
    if (medianInterval === 0 || medianInterval < 50 ) return currentBpm || 120; 
    const bpm = 60000 / medianInterval;
    const smoothedBpm = Math.round(currentBpm * 0.8 + bpm * 0.2);
    return smoothedBpm > 0 ? smoothedBpm : 120;
  }, []); // No dependencies that change frequently

  /**
   * The main audio analysis loop, running on each animation frame.
   * Gets spectrum data, calculates energies, detects beats, estimates BPM, and applies AGC.
   * Updates the global audioData state.
   */
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
    
    console.log(
        '[RAW Audio Data] Sum:', spectrumSum,
        'Bins (first 5):', Array.from(currentSpectrum.slice(0,5)),
        'Manual Gain Setting:', settingsRef.current.gain,
        'Actual GainNode Value:', gainNodeRef.current?.gain.value.toFixed(3)
    );

    let energyAndRmsResult: Pick<AudioData, 'bassEnergy' | 'midEnergy' | 'trebleEnergy' | 'rms'> & { newBeat: boolean };
    let calculatedBpm = currentGlobalAudioData.bpm; 
    let finalSpectrumToSet: Uint8Array;

    if (spectrumSum < EFFECTIVE_SILENCE_THRESHOLD_SUM) {
      energyAndRmsResult = { bassEnergy: 0, midEnergy: 0, trebleEnergy: 0, rms: 0, newBeat: false };
      finalSpectrumToSet = new Uint8Array(currentSpectrum.length).fill(0);
      previousRmsRef.current = 0; 
    } else {
      energyAndRmsResult = calculateEnergy(
        currentSpectrum,
        previousRmsRef.current,
        lastBeatTimeRef.current,
        previousRmsRef.current
      );
      previousRmsRef.current = energyAndRmsResult.rms; 

      if (energyAndRmsResult.newBeat) {
          const currentTime = performance.now();
          lastBeatTimeRef.current = currentTime;
          beatTimestampsRef.current = [...beatTimestampsRef.current, currentTime].slice(-20); 
      }
      calculatedBpm = estimateBPM(beatTimestampsRef.current, currentGlobalAudioData.bpm);
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

    if (settingsRef.current.enableAgc && gainNodeRef.current && audioContextRef.current && audioContextRef.current.state === 'running') {
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
    localAnalysisLoopFrameIdRef.current = requestAnimationFrame(analyze);
  }, [calculateEnergy, estimateBPM, setAudioData, currentGlobalAudioData.bpm]); // Removed settingsRef dependencies (gain, enableAgc) to stabilize `analyze`

  // Effect to manage the analysis loop based on initialization state
  useEffect(() => {
    if (isInitializedInternalActual && audioContextRef.current && audioContextRef.current.state === 'running') {
      console.log("Starting audio analysis loop (from isInitialized/context state effect).");
      if (!localAnalysisLoopFrameIdRef.current) { 
          localAnalysisLoopFrameIdRef.current = requestAnimationFrame(analyze);
      }
    } else {
      console.log("Condition not met for starting audio analysis loop or loop needs to stop.");
      if (localAnalysisLoopFrameIdRef.current) {
        cancelAnimationFrame(localAnalysisLoopFrameIdRef.current);
        console.log("Cleared localAnimationFrameId during isInitialized/context state effect cleanup. ID:", localAnalysisLoopFrameIdRef.current);
        localAnalysisLoopFrameIdRef.current = null;
      }
    }
    return () => {
        if (localAnalysisLoopFrameIdRef.current) {
            cancelAnimationFrame(localAnalysisLoopFrameIdRef.current);
            console.log("Cleanup for isInitialized/context state effect (the one that runs analyze). Clearing localAnimationFrameId:", localAnalysisLoopFrameIdRef.current);
            localAnalysisLoopFrameIdRef.current = null;
        }
    };
  }, [isInitializedInternalActual, analyze]);

  // Effect to update gain based on manual settings (only if AGC is off)
  useEffect(() => {
    if (isInitializedInternalActual && gainNodeRef.current && audioContextRef.current && audioContextRef.current.state === 'running') {
      if (!settingsRef.current.enableAgc) {
        gainNodeRef.current.gain.setTargetAtTime(settingsRef.current.gain, audioContextRef.current.currentTime, 0.05);
      }
    }
  }, [isInitializedInternalActual, settings.gain, settings.enableAgc]); // Keep settings.enableAgc here as it's crucial for this effect's logic

  // Effect to update FFT size
  useEffect(() => {
    if (analyserRef.current && isInitializedInternalActual) {
      if (settingsRef.current.fftSize !== analyserRef.current.fftSize) {
        analyserRef.current.fftSize = settingsRef.current.fftSize;
        const newFrequencyBinCount = analyserRef.current.frequencyBinCount;
        dataArrayRef.current = new Uint8Array(newFrequencyBinCount);
        setAudioData(prev => ({ ...prev, spectrum: new Uint8Array(newFrequencyBinCount).fill(0) }));
        console.log("Analyser fftSize updated to:", settingsRef.current.fftSize, "New frequencyBinCount:", newFrequencyBinCount);
      }
    }
  }, [isInitializedInternalActual, settings.fftSize, setAudioData]);

  // Effect to manage audio monitoring connection
  useEffect(() => {
    if (isInitializedInternalActual && gainNodeRef.current && audioContextRef.current && audioContextRef.current.destination) {
      if (settingsRef.current.monitorAudio) {
        gainNodeRef.current.connect(audioContextRef.current.destination);
        console.log("Audio monitoring enabled: GainNode connected to destination.");
      } else {
        try {
          gainNodeRef.current.disconnect(audioContextRef.current.destination);
          console.log("Audio monitoring disabled: GainNode disconnected from destination.");
        } catch (e) { /* ignore if already disconnected */ }
      }
    }
    return () => {
      if (gainNodeRef.current && audioContextRef.current && audioContextRef.current.destination && audioContextRef.current.state === 'running') {
        try {
          gainNodeRef.current.disconnect(audioContextRef.current.destination);
        } catch (e) { /* ignore */ }
      }
    };
  }, [isInitializedInternalActual, settings.monitorAudio]);

  // Final cleanup effect: runs only once when the hook is unmounted
  useEffect(() => {
    return () => {
      console.log("useAudioAnalysis hook is UNMOUNTING, calling stopAudioAnalysis for final cleanup.");
      stopAudioAnalysis();
    };
  }, []); // Empty dependency array ensures this runs only on final unmount

  return { 
    initializeAudio, 
    stopAudioAnalysis, 
    isInitialized: isInitializedInternalActual, 
    error: errorInternalActual,
    audioInputDevices
  };
}
