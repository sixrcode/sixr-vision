
"use client";

import { useEffect, useRef, useState } from 'react';
import { useSettingsStore } from '@/store/settingsStore'; // MODIFIED: Import Zustand store
import { toast } from '@/hooks/use-toast';

type WebcamFeedProps = {
  onWebcamElement: (element: HTMLVideoElement | null) => void;
};

export function WebcamFeed({ onWebcamElement }: WebcamFeedProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  // MODIFIED: Use Zustand store selector
  const showWebcam = useSettingsStore(state => state.showWebcam);
  const [activeStream, setActiveStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    const videoNode = videoRef.current;
    if (!videoNode) return;

    const handleMediaReady = () => {
      if (videoNode.videoWidth > 0 && videoNode.videoHeight > 0) {
        onWebcamElement(videoNode);
      } else {
        // Fallback if dimensions aren't ready but stream is supposedly active
        // This might happen if events fire in an unexpected order
        if (videoNode.srcObject) {
            onWebcamElement(videoNode); // Pass it anyway, scene can check dimensions
        } else {
            onWebcamElement(null);
        }
      }
    };

    const cleanupStream = (stream: MediaStream | null) => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (videoNode.srcObject) {
        videoNode.srcObject = null;
      }
      onWebcamElement(null);
      setActiveStream(null);
    };

    if (showWebcam) { // MODIFIED: Use showWebcam from Zustand
      // Stop previous stream if any
      if (activeStream) {
        cleanupStream(activeStream);
      }

      navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        .then(stream => {
          setActiveStream(stream);
          videoNode.srcObject = stream;
          videoNode.addEventListener('loadedmetadata', handleMediaReady);
          videoNode.addEventListener('canplay', handleMediaReady);
          videoNode.play().catch(err => { // Autoplay might be blocked
            console.warn("Webcam autoplay prevented:", err);
            // Manually trigger ready check if play fails but stream is there
            if (videoNode.srcObject) handleMediaReady();
          });
        })
        .catch(err => {
          console.error('Error accessing webcam:', err);
          toast({
            title: 'Webcam Error',
            description: 'Could not access webcam. Please check permissions.',
            variant: 'destructive',
          });
          cleanupStream(activeStream); // Clean up any partially active stream
        });
    } else {
      cleanupStream(activeStream);
    }

    return () => {
      videoNode.removeEventListener('loadedmetadata', handleMediaReady);
      videoNode.removeEventListener('canplay', handleMediaReady);
      cleanupStream(activeStream); // Cleanup on component unmount or effect re-run
    };
  // onWebcamElement and activeStream are part of the effect's closure and dependencies.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showWebcam, onWebcamElement]); // MODIFIED: Dependency on showWebcam from Zustand


  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      className={
        // Keep the video element in the DOM but hidden for processing
        "absolute top-[-9999px] left-[-9999px] w-[1px] h-[1px] opacity-0 pointer-events-none -z-10"
      }
    />
  );
}
