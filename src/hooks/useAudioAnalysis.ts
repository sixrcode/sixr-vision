"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import type { AudioData, Settings } from '@/types';
import { useAudioData } from '@/providers/AudioDataProvider';
import { useSettings } from '@/providers/SettingsProvider';
import { INITIAL_AUDIO_DATA } from '@/lib/constants';

// Simple Beat Detection Threshold
const BEAT_DETECTION_THRESHOLD = 0.7; // Adjust this based on sensitivity
const RMS_SMOOTHING_FACTOR = 0.1; // For smoothing RMS values

export function useAudioAnalysis() {
  const { settings } = useSettings();
  const { setAudioData } = useAudioData();
  
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


  const calculateEnergy = useCallback((spectrum: Uint8Array, fftSize: number): Pick<AudioData, 'bassEnergy' | 'midEnergy' | 'trebleEnergy' | 'rms' | 'beat'> => {
    const nyquist = audioContextRef.current!.sampleRate / 2;
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
    if (beatTimestamps.length < 5) return settings.bpm || 120; // Not enough data, use current or default

    const intervals = [];
    for (let i = 1; i < beatTimestamps.length; i++) {
      intervals.push(beatTimestamps[i] - beatTimestamps[i-1]);
    }
    
    if (intervals.length === 0) return settings.bpm || 120;

    // Median interval for robustness
    intervals.sort((a, b) => a - b);
    const medianInterval = intervals[Math.floor(intervals.length / 2)];
    
    if (medianInterval === 0) return settings.bpm || 120;
    
    const bpm = 60000 / medianInterval;
    return Math.round(bpm); // Return a smoothed or rounded BPM
  }, [beatTimestamps, settings.bpm]);

  const analyze = useCallback(() => {
    if (!analyserRef.current || !dataArrayRef.current) return;

    analyserRef.current.getByteFrequencyData(dataArrayRef.current);
    const energy = calculateEnergy(dataArrayRef.current, settings.fftSize);
    const bpm = estimateBPM();

    setAudioData({
      spectrum: new Uint8Array(dataArrayRef.current), // Clone array
      ...energy,
      bpm,
    });

    animationFrameIdRef.current = requestAnimationFrame(analyze);
  }, [settings.fftSize, calculateEnergy, estimateBPM, setAudioData]);


  const initializeAudio = useCallback(async () => {
    if (isInitialized) return;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      sourceNodeRef.current = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      gainNodeRef.current = audioContextRef.current.createGain();

      analyserRef.current.fftSize = settings.fftSize;
      analyserRef.current.smoothingTimeConstant = 0.8; // Adjust as needed
      
      dataArrayRef.current = new Uint8Array(analyserRef.current.frequencyBinCount);

      sourceNodeRef.current.connect(gainNodeRef.current);
      gainNodeRef.current.connect(analyserRef.current);
      // For AGC, analyser might connect directly or after an AGC node (not implemented here)
      // If not connecting to destination, analyser is enough for data.
      // gainNodeRef.current.connect(audioContextRef.current.destination); // Optional: play audio through

      gainNodeRef.current.gain.setValueAtTime(settings.gain, audioContextRef.current.currentTime);

      setIsInitialized(true);
      analyze();
    } catch (err) {
      console.error("Error initializing audio:", err);
      setError(err instanceof Error ? err.message : String(err));
      setIsInitialized(false);
    }
  }, [isInitialized, settings.fftSize, settings.gain, analyze]);


  useEffect(() => {
    if (analyserRef.current && settings.fftSize !== analyserRef.current.fftSize) {
      analyserRef.current.fftSize = settings.fftSize;
      dataArrayRef.current = new Uint8Array(analyserRef.current.frequencyBinCount);
      setAudioData({ spectrum: new Uint8Array(analyserRef.current.frequencyBinCount).fill(0) });
    }
    if (gainNodeRef.current && audioContextRef.current) {
      gainNodeRef.current.gain.setValueAtTime(settings.gain, audioContextRef.current.currentTime);
    }
    // TODO: Implement AGC logic if settings.enableAgc is true
  }, [settings.fftSize, settings.gain, settings.enableAgc, setAudioData]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      if (sourceNodeRef.current) {
        sourceNodeRef.current.disconnect();
        // Stop tracks on the stream
        sourceNodeRef.current.mediaStream.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      setIsInitialized(false);
    };
  }, []);

  return { initializeAudio, isInitialized, error };
}
