
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
  const [currentStream, setCurrentStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    const videoNode = videoRef.current;
    if (!videoNode) return;

    const handleMediaReady = () => {
      if (settings.showWebcam && videoNode.videoWidth > 0 && videoNode.videoHeight > 0) {
        onWebcamElement(videoNode);
      } else if (!settings.showWebcam) {
        // If webcam was disabled while media was loading or after it was ready
        onWebcamElement(null);
      }
      // If settings.showWebcam is true but dimensions are 0, we wait for another event or state change.
    };

    async function setupWebcam() {
      if (settings.showWebcam) {
        // If a stream is already active and assigned, and dimensions are good, ensure callback is called.
        if (currentStream && videoNode.srcObject === currentStream && videoNode.videoWidth > 0 && videoNode.videoHeight > 0) {
          onWebcamElement(videoNode);
          return; // Already set up and ready
        }

        // Stop any existing stream before starting a new one
        if (currentStream) {
          currentStream.getTracks().forEach(track => track.stop());
          setCurrentStream(null); // Clear the state for the old stream
        }
        if (videoNode.srcObject) { // Clear srcObject from video element too
            const tracks = (videoNode.srcObject as MediaStream).getTracks();
            tracks.forEach(track => track.stop());
            videoNode.srcObject = null;
        }


        try {
          const mediaStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false, 
          });
          setCurrentStream(mediaStream); 
          videoNode.srcObject = mediaStream;
          // Event listeners ('loadedmetadata', 'canplay') should trigger handleMediaReady
          // once the stream is loaded and dimensions are known.
        } catch (err) {
          console.error('Error accessing webcam:', err);
          toast({
            title: 'Webcam Error',
            description: 'Could not access webcam. Please check permissions.',
            variant: 'destructive',
          });
          onWebcamElement(null); // Notify that webcam is not available
          if (currentStream) { // Ensure cleanup if any stream was just set
            currentStream.getTracks().forEach(track => track.stop());
            setCurrentStream(null);
          }
           if(videoNode.srcObject) videoNode.srcObject = null;
        }
      } else { // settings.showWebcam is false, so tear down
        if (currentStream) {
          currentStream.getTracks().forEach(track => track.stop());
          setCurrentStream(null);
        }
        if (videoNode.srcObject) {
           videoNode.srcObject = null;
        }
        onWebcamElement(null); // Explicitly notify that webcam is off
      }
    }

    // Add event listeners if we intend to show the webcam
    if (settings.showWebcam) {
      videoNode.addEventListener('loadedmetadata', handleMediaReady);
      videoNode.addEventListener('canplay', handleMediaReady);
    }
    
    setupWebcam();

    return () => {
      videoNode.removeEventListener('loadedmetadata', handleMediaReady);
      videoNode.removeEventListener('canplay', handleMediaReady);
      // Stream cleanup for the *current* stream is handled by the separate effect below.
      // This cleanup handles the case where the component unmounts while settings.showWebcam is true
      // and a stream might be attached to videoNode.srcObject directly.
      if (videoNode.srcObject && videoNode.srcObject instanceof MediaStream) {
         (videoNode.srcObject as MediaStream).getTracks().forEach(track => track.stop());
      }
    };
  }, [settings.showWebcam, onWebcamElement]); // currentStream is not a direct dependency for re-running setup logic

  // Effect to clean up the currentStream when it changes or component unmounts
  useEffect(() => {
    const streamToClean = currentStream; 
    return () => {
      if (streamToClean) {
        streamToClean.getTracks().forEach(track => track.stop());
      }
    };
  }, [currentStream]);


  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      className={
        settings.showWebcam
          ? "absolute top-[-9999px] left-[-9999px] w-[1px] h-[1px] opacity-0 pointer-events-none -z-10"
          : "hidden"
      }
    />
  );
}
