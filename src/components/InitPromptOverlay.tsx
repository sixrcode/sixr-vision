
'use client'
import { useEffect, useState } from 'react'
import { useAudioAnalysis } from '@/hooks/useAudioAnalysis' // For mic status and initialization
import { useSettingsStore } from '@/store/settingsStore'    // For webcam status and enabling
import { Button } from '@/components/ui/button'              // For consistent button styling
import { Mic, Camera, Info, CheckCircle2, Loader2 } from 'lucide-react' // Icons, added CheckCircle2, Loader2
import { cn } from '@/lib/utils'

export default function InitPromptOverlay() {
  const [isVisible, setIsVisible] = useState(false);
  const [isLoadingMic, setIsLoadingMic] = useState(false);
  const [isLoadingCam, setIsLoadingCam] = useState(false);
  const [isLoadingBoth, setIsLoadingBoth] = useState(false);

  const { initializeAudio, isInitialized: micActive, error: audioError } = useAudioAnalysis();
  const showWebcam = useSettingsStore(state => state.showWebcam);
  const updateSetting = useSettingsStore(state => state.updateSetting);

  useEffect(() => {
    // Show the prompt if neither mic nor cam is active/enabled,
    // OR if there's an audio error (which means mic isn't truly active in a usable way).
    const timer = setTimeout(() => {
        if ((!micActive && !showWebcam) || (audioError && !micActive)) {
            setIsVisible(true);
        } else {
            setIsVisible(false);
        }
    }, 750); // Slight delay to allow initial checks to complete
    return () => clearTimeout(timer);
  }, [micActive, showWebcam, audioError]);


  // Hide the overlay if mic becomes active (and no error) or webcam is shown AFTER initial check
  useEffect(() => {
    if ((micActive && !audioError) || showWebcam) {
      setIsVisible(false);
    }
  }, [micActive, showWebcam, audioError]);

  const handleEnableMic = async () => {
    setIsLoadingMic(true);
    setIsLoadingBoth(false); // Ensure "Enable Both" loading state is cleared
    try {
      await initializeAudio();
    } finally {
      setIsLoadingMic(false);
    }
  };

  const handleEnableCam = () => {
    setIsLoadingCam(true);
    setIsLoadingBoth(false); // Ensure "Enable Both" loading state is cleared
    try {
      updateSetting('showWebcam', true);
    } finally {
      setIsLoadingCam(false);
    }
  };

  const handleEnableBoth = async () => {
    setIsLoadingBoth(true);
    setIsLoadingMic(false); // Clear individual loading states
    setIsLoadingCam(false);
    let micInitializedSuccessfully = false;
    try {
      micInitializedSuccessfully = await initializeAudio();
      if (micInitializedSuccessfully) {
        updateSetting('showWebcam', true);
      }
    } finally {
      setIsLoadingBoth(false);
      // Visibility will be handled by the useEffect above based on micActive, showWebcam, and audioError
    }
  };

  if (!isVisible) return null;

  const micFullyActive = micActive && !audioError;
  const bothEnabled = micFullyActive && showWebcam;

  return (
    <div className={cn(
        "fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[9999]",
        "transition-opacity duration-300 ease-in-out",
        isVisible ? "opacity-100" : "opacity-0 pointer-events-none"
      )}
      role="dialog"
      aria-labelledby="init-prompt-title"
      aria-modal="true"
    >
      <div className="p-6 bg-card text-card-foreground rounded-lg max-w-md w-11/12 text-center shadow-xl border border-border">
        <div className="flex justify-center mb-4">
          <Info className="w-10 h-10 text-primary" />
        </div>
        <h2 id="init-prompt-title" className="text-xl mb-3 font-semibold">Enable Audio & Camera</h2>
        <p className="text-sm text-muted-foreground mb-6">
          For the full SIXR Vision experience, please grant access to your microphone for audio-reactive visuals and (optionally) your camera for interactive scenes.
        </p>
        <div className="flex flex-col gap-3 justify-center">
          <Button
            onClick={handleEnableBoth}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
            disabled={bothEnabled || isLoadingBoth || isLoadingMic || isLoadingCam}
            aria-label={isLoadingBoth ? "Enabling Microphone and Camera..." : (bothEnabled ? "Microphone and Camera Enabled" : "Enable Microphone and Camera")}
          >
            {isLoadingBoth ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : bothEnabled ? (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            ) : (
              <Mic className="mr-2 h-4 w-4" /> /* Default icon, can be changed */
            )}
            {isLoadingBoth ? "Enabling Both..." : bothEnabled ? "Mic & Cam Enabled" : "Enable Both"}
          </Button>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={handleEnableMic}
              className="w-full sm:w-auto flex-1"
              variant="outline"
              disabled={micFullyActive || isLoadingMic || isLoadingBoth}
              aria-label={isLoadingMic ? "Enabling Microphone..." : (micFullyActive ? "Microphone Enabled" : (audioError ? "Retry Microphone Initialization" : "Enable Microphone"))}
            >
              {isLoadingMic ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : micFullyActive ? (
                <CheckCircle2 className="mr-2 h-4 w-4 text-success" />
              ) : (
                <Mic className="mr-2 h-4 w-4" />
              )}
              {isLoadingMic ? "Enabling Mic..." : micFullyActive ? "Mic Enabled" : (audioError ? "Retry Mic" : "Enable Mic")}
            </Button>
            <Button
              onClick={handleEnableCam}
              variant="outline"
              className="w-full sm:w-auto flex-1"
              disabled={showWebcam || isLoadingCam || isLoadingBoth}
              aria-label={isLoadingCam ? "Enabling Camera..." : (showWebcam ? "Camera Enabled" : "Enable Camera")}
            >
              {isLoadingCam ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : showWebcam ? (
                <CheckCircle2 className="mr-2 h-4 w-4 text-success" />
              ) : (
                <Camera className="mr-2 h-4 w-4" />
              )}
              {isLoadingCam ? "Enabling Cam..." : showWebcam ? "Cam Enabled" : "Enable Cam"}
            </Button>
          </div>
        </div>
        {audioError && !micActive && (
            <p className="text-xs text-destructive mt-4">
                Mic Error: {audioError}. Please check browser permissions and audio device selection in settings.
            </p>
        )}
        <p className="text-xs text-muted-foreground mt-6">
            You can manage permissions in your browser settings at any time. Click the Mic/Cam icons in the top-right of the control panel to re-attempt initialization.
        </p>
      </div>
    </div>
  );
}
