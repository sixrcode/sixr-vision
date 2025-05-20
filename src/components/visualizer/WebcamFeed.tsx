
"use client";

import { useEffect, useRef, useState } from 'react';
import { useSettings } from '@/providers/SettingsProvider';
import { toast } from '@/hooks/use-toast';

type WebcamFeedProps = {
  onWebcamElement: (element: HTMLVideoElement | null) => void;
};

export function WebcamFeed({ onWebcamElement }: WebcamFeedProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { settings } = useSettings();
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    const videoNode = videoRef.current;
    if (!videoNode) return;

    const handleMediaReady = () => {
      // Ensure videoWidth and videoHeight are available and stream is active
      if (videoNode.videoWidth > 0 && videoNode.videoHeight > 0 && stream && settings.showWebcam) {
        onWebcamElement(videoNode);
      }
    };

    async function setupWebcam() {
      if (settings.showWebcam) {
        if (stream && videoNode.srcObject === stream) {
          // Stream already active, video element might be ready or will fire event
          if (videoNode.videoWidth > 0 && videoNode.videoHeight > 0) {
            onWebcamElement(videoNode);
          }
          return; // Listener will handle if not yet ready
        }
        try {
          const mediaStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false, // Audio is handled by useAudioAnalysis
          });
          setStream(mediaStream);
          videoNode.srcObject = mediaStream;
          // 'loadedmetadata' or 'canplay' will call onWebcamElement via handleMediaReady
        } catch (err) {
          console.error('Error accessing webcam:', err);
          toast({
            title: 'Webcam Error',
            description: 'Could not access webcam. Please check permissions.',
            variant: 'destructive',
          });
          onWebcamElement(null);
        }
      } else { // settings.showWebcam is false
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
          setStream(null);
        }
        if (videoNode.srcObject) {
           videoNode.srcObject = null;
        }
        onWebcamElement(null);
      }
    }

    if (settings.showWebcam) {
      videoNode.addEventListener('loadedmetadata', handleMediaReady);
      videoNode.addEventListener('canplay', handleMediaReady);
    }
    
    setupWebcam();

    return () => {
      videoNode.removeEventListener('loadedmetadata', handleMediaReady);
      videoNode.removeEventListener('canplay', handleMediaReady);
    };
  }, [settings.showWebcam, stream, onWebcamElement]);

  // Effect to clean up stream if component unmounts or stream object changes
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);


  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      className={
        settings.showWebcam
          ? "absolute top-[-9999px] left-[-9999px] w-auto h-auto opacity-0 pointer-events-none -z-10"
          : "hidden"
      }
    />
  );
}
