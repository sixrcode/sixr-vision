
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

  const { initializeAudio, isInitialized: micActive, error: audioError } = useAudioAnalysis() as { initializeAudio: () => Promise<boolean>, isInitialized: boolean, error: Error | string | null };
  const showWebcam = useSettingsStore(state => state.showWebcam);
  const updateSetting = useSettingsStore(state => state.updateSetting);

  useEffect(() => {
    // Show the prompt if neither mic nor cam is active/enabled,
    // OR if there's an audio error (which means mic isn't truly active in a usable way).
    const timer = setTimeout(() => {
        // If mic is not truly active (either not initialized or error present) AND webcam is not shown, then prompt.
        // OR if mic is fine but webcam is not shown, still prompt (to enable cam).
        // OR if webcam is fine but mic is not, still prompt (to enable mic).
        // Essentially, prompt if either is missing or if mic has an error.
        // Check if audioError is an object and has a message property before accessing message.
        const hasAudioErrorMessage = typeof audioError === 'object' && audioError !== null && 'message' in audioError && typeof audioError.message === 'string';

        if ((!micActive || hasAudioErrorMessage) || !showWebcam ) {
             // But only if we are not in the middle of an "Enable Both" attempt that might succeed.
            if (!isLoadingBoth) {
                setIsVisible(true);
            }
        } else {
            setIsVisible(false);
        }
    }, 750); // Slight delay to allow initial checks to complete
    return () => clearTimeout(timer);
  }, [micActive, showWebcam, audioError, isLoadingBoth]);


  // Hide the overlay if mic becomes active (and no error) AND webcam is shown
  useEffect(() => {
    if (micActive && !audioError && showWebcam) {
      setIsVisible(false);
    }
  }, [micActive, showWebcam, audioError]);

  const handleEnableMic = async () => {
    setIsLoadingMic(true);
    setIsLoadingBoth(false);
    try {
      await initializeAudio();
    } finally {
      setIsLoadingMic(false);
    }
  };

  const handleEnableCam = () => {
    setIsLoadingCam(true);
    setIsLoadingBoth(false);
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
    let micOk = false;
    // camOk will be inferred from the showWebcam setting after the attempt
    // For logging purposes, we can track if the attempt was made.
    let camEnableAttempted = false;

    try {
      // Initialize audio first
      console.log("[InitPromptOverlay - EnableBoth] Attempting audio initialization...");
      micOk = await initializeAudio();
      console.log("[InitPromptOverlay - EnableBoth] Audio initialization successful:", micOk);

      if (micOk) {
        console.log("[InitPromptOverlay - EnableBoth] Audio OK. Attempting to enable camera setting...");
        updateSetting('showWebcam', true);
        camEnableAttempted = true;
        console.log("[InitPromptOverlay - EnableBoth] Camera enabling setting updated (showWebcam: true).");
      } else {
        console.log("[InitPromptOverlay - EnableBoth] Microphone initialization failed. Camera enabling will not be attempted.");
      }
    } catch (error) {
        console.error("[InitPromptOverlay - EnableBoth] Error during 'Enable Both' process:", error);
    } finally {
      setIsLoadingBoth(false);
      // Log the outcome. Actual camera status is reflected by `showWebcam` from Zustand.
      console.info(
        "[InitPromptOverlay - EnableBoth] Process finished. Mic init success:", micOk, 
        "Camera enable attempted:", camEnableAttempted
      );
    }
  };

  if (!isVisible) return null;

  const micFullyActive = micActive && !audioError;
  const bothEnabledAndReady = micFullyActive && showWebcam;

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
            disabled={bothEnabledAndReady || isLoadingBoth || isLoadingMic || isLoadingCam}
            aria-label={isLoadingBoth ? "Enabling Microphone and Camera..." : (bothEnabledAndReady ? "Microphone and Camera Enabled" : "Enable Microphone and Camera")}
          >
            {isLoadingBoth ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : bothEnabledAndReady ? (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            ) : (
              <Mic className="mr-2 h-4 w-4" />
            )}
            {isLoadingBoth ? "Enabling Both..." : bothEnabledAndReady ? "Mic & Cam Enabled" : "Enable Both"}
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
                Mic Error: {typeof audioError === 'string' ? audioError : (audioError as Error).message}. Please check browser permissions and audio device selection in settings.
            </p>
        )}
        <p className="text-xs text-muted-foreground mt-6">
            You can manage permissions in your browser settings at any time. Click the Mic/Cam icons in the top-right of the control panel to re-attempt initialization.
        </p>
      </div>
    </div>
  );
}
