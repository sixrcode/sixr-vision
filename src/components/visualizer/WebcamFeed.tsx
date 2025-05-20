"use client";

import { useEffect, useRef, useState } from 'react';
import { useSettings } from '@/providers/SettingsProvider';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

type WebcamFeedProps = {
  onWebcamElement: (element: HTMLVideoElement | null) => void;
};

export function WebcamFeed({ onWebcamElement }: WebcamFeedProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { settings } = useSettings();
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    async function setupWebcam() {
      if (settings.showWebcam && !stream) {
        try {
          const mediaStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false, // Audio is handled by useAudioAnalysis
          });
          setStream(mediaStream);
          if (videoRef.current) {
            videoRef.current.srcObject = mediaStream;
            onWebcamElement(videoRef.current);
          }
        } catch (err) {
          console.error('Error accessing webcam:', err);
          toast({
            title: 'Webcam Error',
            description: 'Could not access webcam. Please check permissions.',
            variant: 'destructive',
          });
          onWebcamElement(null);
        }
      } else if (!settings.showWebcam && stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
        onWebcamElement(null);
      }
    }

    setupWebcam();

    // Cleanup stream on component unmount if it's active
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [settings.showWebcam, stream, onWebcamElement]);

  // The actual video element is not rendered visibly here.
  // It's passed to the VisualizerView to be drawn onto the main canvas.
  // This component just manages the stream.
  // We could render it for debug purposes if needed.
  // <video ref={videoRef} autoPlay playsInline muted className="hidden" />

  return <video ref={videoRef} autoPlay playsInline muted className={cn("hidden", settings.showWebcam && "fixed opacity-0 pointer-events-none -z-50 w-1 h-1")} />; // Keep it in DOM but hidden
}
