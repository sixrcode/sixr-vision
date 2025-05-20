
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import type { AudioData, Settings } from '@/types';
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
  const { audioData: currentGlobalAudioData, setAudioData } = useAudioData(); // Renamed to avoid conflict
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
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


    // Simple beat detection: significant increase in bass energy or overall RMS
    let beat = false;
    const currentTime = performance.now();
    if ((bassEnergy > BEAT_DETECTION_THRESHOLD && bassEnergy > midEnergy && bassEnergy > trebleEnergy && currentTime - lastBeatTime > 200) || // Min 200ms between beats
        (rms > previousRms * 1.2 && rms > 0.1 && currentTime - lastBeatTime > 150) ) { 
      beat = true;
      setLastBeatTime(currentTime);
      setBeatTimestamps(prev => {
        const newTimestamps = [...prev, currentTime].slice(-20); // Keep last 20 beats for BPM
        return newTimestamps;
      });
    }

    return { bassEnergy, midEnergy, trebleEnergy, rms, beat };
  }, [lastBeatTime, previousRms]);

  const estimateBPM = useCallback((): number => {
    if (beatTimestamps.length < 5) return currentGlobalAudioData.bpm || 120; // Use current global BPM or default

    const intervals = [];
    for (let i = 1; i < beatTimestamps.length; i++) {
      intervals.push(beatTimestamps[i] - beatTimestamps[i-1]);
    }
    
    if (intervals.length === 0) return currentGlobalAudioData.bpm || 120;

    intervals.sort((a, b) => a - b);
    const medianInterval = intervals[Math.floor(intervals.length / 2)];
    
    if (medianInterval === 0 || medianInterval < 50 ) return currentGlobalAudioData.bpm || 120; // Avoid too high BPM / div by zero
    
    const bpm = 60000 / medianInterval;
    // Smooth BPM update
    const smoothedBpm = Math.round(currentGlobalAudioData.bpm * 0.8 + bpm * 0.2);
    return smoothedBpm;
  }, [beatTimestamps, currentGlobalAudioData.bpm]);

  const analyze = useCallback(() => {
    if (!analyserRef.current || !dataArrayRef.current || !audioContextRef.current) {
      animationFrameIdRef.current = requestAnimationFrame(analyze); // Keep trying
      return;
    }

    analyserRef.current.getByteFrequencyData(dataArrayRef.current);
    const energyAndRms = calculateEnergy(dataArrayRef.current);
    const bpm = estimateBPM();

    setAudioData({
      spectrum: new Uint8Array(dataArrayRef.current), // Clone array
      ...energyAndRms,
      bpm,
    });

    // AGC Logic
    if (settings.enableAgc && gainNodeRef.current && audioContextRef.current.state === 'running') {
        const currentRms = energyAndRms.rms; 
        const currentGain = gainNodeRef.current.gain.value;

        if (currentRms > 0.005) { // Only adjust if there's some meaningful signal
            let targetGain = currentGain * (AGC_TARGET_RMS / currentRms);
            targetGain = Math.max(AGC_MIN_GAIN, Math.min(AGC_MAX_GAIN, targetGain));
            
            const timeConstant = currentRms > AGC_TARGET_RMS ? AGC_ATTACK_TIME_CONSTANT : AGC_RELEASE_TIME_CONSTANT;

            gainNodeRef.current.gain.setTargetAtTime(
                targetGain,
                audioContextRef.current.currentTime,
                timeConstant
            );
        } else { // Very low signal, potentially ramp gain slowly towards a neutral point if it's too high
            if (currentGain > 1.5) { // If gain is significantly high during silence
                 gainNodeRef.current.gain.setTargetAtTime(
                    1.0, // Ramp towards a neutral gain of 1.0
                    audioContextRef.current.currentTime,
                    AGC_RELEASE_TIME_CONSTANT * 2 // Slower release during silence
                );
            }
        }
    }
    animationFrameIdRef.current = requestAnimationFrame(analyze);
  }, [settings.enableAgc, calculateEnergy, estimateBPM, setAudioData]);


  const initializeAudio = useCallback(async () => {
    if (isInitialized || audioContextRef.current?.state === 'running') return;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      sourceNodeRef.current = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      gainNodeRef.current = audioContextRef.current.createGain();

      analyserRef.current.fftSize = settings.fftSize;
      analyserRef.current.smoothingTimeConstant = 0.8; 
      
      dataArrayRef.current = new Uint8Array(analyserRef.current.frequencyBinCount);

      sourceNodeRef.current.connect(gainNodeRef.current);
      gainNodeRef.current.connect(analyserRef.current);
      
      // Initial gain setting
      if (settings.enableAgc) {
        // If AGC is on by default, start with a neutral gain. AGC will adjust it.
        gainNodeRef.current.gain.setValueAtTime(1.0, audioContextRef.current.currentTime);
      } else {
        gainNodeRef.current.gain.setValueAtTime(settings.gain, audioContextRef.current.currentTime);
      }

      setIsInitialized(true);
      setError(null); // Clear any previous error
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current); // Ensure no duplicates
      analyze();
    } catch (err) {
      console.error("Error initializing audio:", err);
      setError(err instanceof Error ? err.message : String(err));
      setIsInitialized(false);
      setAudioData(INITIAL_AUDIO_DATA); // Reset audio data on error
    }
  }, [isInitialized, settings.fftSize, settings.gain, settings.enableAgc, analyze, setAudioData]);


  useEffect(() => {
    // Effect to handle enabling/disabling AGC and manual gain changes
    if (!isInitialized || !audioContextRef.current || !gainNodeRef.current) return;

    if (settings.enableAgc) {
        // AGC is enabled. The `analyze` function handles dynamic gain adjustments.
        // If gain was previously set manually, AGC will now take over.
        // It might be good to ensure a smooth transition if AGC is toggled ON.
        // For now, analyze() will start adjusting from current gain value.
    } else {
        // AGC is disabled. Set gain to the manual `settings.gain` value.
        if (audioContextRef.current.state === 'running') {
            gainNodeRef.current.gain.setTargetAtTime(
                settings.gain,
                audioContextRef.current.currentTime,
                0.05 // A small time constant for a smooth transition back to manual
            );
        } else {
             // If context is not running (e.g., suspended), set value directly.
            gainNodeRef.current.gain.value = settings.gain;
        }
    }
  }, [settings.enableAgc, settings.gain, isInitialized]);

  useEffect(() => {
    // Effect to handle FFT size changes
    if (analyserRef.current && dataArrayRef.current && settings.fftSize !== analyserRef.current.fftSize) {
      analyserRef.current.fftSize = settings.fftSize;
      const newFrequencyBinCount = analyserRef.current.frequencyBinCount;
      dataArrayRef.current = new Uint8Array(newFrequencyBinCount);
      // Update global audioData with new spectrum array size, filled with 0
      setAudioData(prev => ({ 
        ...prev, 
        spectrum: new Uint8Array(newFrequencyBinCount).fill(0) 
      }));
    }
  }, [settings.fftSize, setAudioData]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      if (sourceNodeRef.current) {
        sourceNodeRef.current.mediaStream?.getTracks().forEach(track => track.stop());
        sourceNodeRef.current.disconnect();
      }
      if (gainNodeRef.current) {
        gainNodeRef.current.disconnect();
      }
      if(analyserRef.current){
        analyserRef.current.disconnect();
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(e => console.error("Error closing audio context", e));
      }
      audioContextRef.current = null; // Ensure it's nulled for re-initialization checks
      analyserRef.current = null;
      gainNodeRef.current = null;
      sourceNodeRef.current = null;
      setIsInitialized(false);
    };
  }, []);

  return { initializeAudio, isInitialized, error };
}

