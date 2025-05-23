
"use client";

import { useEffect, useState, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { SixrLogo } from '@/components/icons/SixrLogo';
import { AudioControls } from './AudioControls';
import { VisualControls } from './VisualControls';
import { WebcamControls } from './WebcamControls';
import { PresetSelector } from './PresetSelector';
import { PaletteGenie } from './ai-tools/PaletteGenie';
import { ProceduralAssetsGenerator } from './ai-tools/ProceduralAssetsGenerator';
import { AiPresetChooser } from './ai-tools/AiPresetChooser';
import { AmbianceGenerator } from './ai-tools/AmbianceGenerator';
import { AiVisualOverlayMixer } from './ai-tools/AiVisualOverlayMixer';
import { LogoAnimationControls } from './LogoAnimationControls';
import { OtherControls } from './OtherControls';
import { useAudioAnalysis } from '@/hooks/useAudioAnalysis';
import { Mic, MicOff, Camera, CameraOff, Loader2 } from 'lucide-react';
import { Accordion } from '@/components/ui/accordion';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSettings } from '@/providers/SettingsProvider';
import { toast } from '@/hooks/use-toast';
import { SBNF_TITLE_FONT_FAMILY, SIXR_S_COLOR, SIXR_I_COLOR, SIXR_X_COLOR, SIXR_R_COLOR } from '@/lib/brandingConstants';
import { cn } from '@/lib/utils';

/**
 * @fileOverview The main view component for the Control Panel sidebar.
 * It orchestrates various control sections, manages audio/webcam initialization,
 * and provides global UI elements like the header and footer.
 */

/**
 * Renders the control panel view for the SIXR Vision application.
 * This component includes the header with global toggles, an accordion of control sections,
 * and a footer with branding. It manages the initialization and toggling of audio and webcam.
 * @returns {JSX.Element} The ControlPanelView component.
 */
export function ControlPanelView() {
  const {
    initializeAudio,
    stopAudioAnalysis,
    isInitialized: isAudioInitialized,
    error: audioError,
    audioInputDevices
  } = useAudioAnalysis();

  const { settings, updateSetting } = useSettings();
  const [isTogglingAudio, setIsTogglingAudio] = useState(false);
  const [isTogglingWebcam, setIsTogglingWebcam] = useState(false);
  const prevSelectedAudioDeviceIdRef = useRef(settings.selectedAudioInputDeviceId);

  useEffect(() => {
    const hasSeenWelcome = localStorage.getItem('sixrVisionWelcomeSeen');
    if (!hasSeenWelcome) {
      toast({
        title: "Welcome to SIXR Vision!",
        description: "Grant microphone and camera permissions to begin. Explore presets and controls on the right.",
        duration: 7000,
      });
      localStorage.setItem('sixrVisionWelcomeSeen', 'true');
    }
  }, []);
  
  // Effect to handle re-initialization if selected audio device changes while audio is active
  useEffect(() => {
    if (
      isAudioInitialized &&
      settings.selectedAudioInputDeviceId !== prevSelectedAudioDeviceIdRef.current
    ) {
      console.log(
        'ControlPanelView: Selected audio device changed while audio is active. Re-initializing audio.'
      );
      const reinitialize = async () => {
        setIsTogglingAudio(true);
        await stopAudioAnalysis();
        await initializeAudio(); // This will use the new deviceId from settings
        setIsTogglingAudio(false);
      };
      reinitialize();
    }
    prevSelectedAudioDeviceIdRef.current = settings.selectedAudioInputDeviceId;
  }, [
    settings.selectedAudioInputDeviceId,
    isAudioInitialized,
    stopAudioAnalysis,
    initializeAudio,
  ]);

  const handleAudioToggle = async () => {
    if (isTogglingAudio) return;
    console.log("ControlPanelView: Toggling audio. Current isInitialized:", isAudioInitialized, "isTogglingAudio:", isTogglingAudio);
    setIsTogglingAudio(true);
    if (isAudioInitialized) {
      await stopAudioAnalysis();
    } else {
      await initializeAudio();
    }
    setIsTogglingAudio(false);
    console.log("ControlPanelView: Audio toggle finished. isInitialized will update on next render.");
  };

  const handleWebcamToggle = async () => {
    if (isTogglingWebcam) return;
    const newWebcamState = !settings.showWebcam;
    console.log("ControlPanelView: Toggling webcam. Current state:", settings.showWebcam, "New state:", newWebcamState);
    setIsTogglingWebcam(true);
    updateSetting('showWebcam', newWebcamState);
    // Small delay to allow for any UI updates related to webcam state change, if necessary
    await new Promise(resolve => setTimeout(resolve, 50));
    setIsTogglingWebcam(false);
    console.log("ControlPanelView: Webcam toggle finished. New showWebcam setting:", newWebcamState);
  };


  return (
    <div className="h-full flex flex-col bg-control-panel-background text-control-panel-foreground">
      <header className="p-4 border-b border-control-panel-border flex justify-between items-center">
        <div className="flex items-center">
          <SixrLogo className="h-6 w-auto mr-2" />
          <h2 className="text-lg font-semibold" style={{ fontFamily: SBNF_TITLE_FONT_FAMILY }}>
            Vision
          </h2>
        </div>

        <div className="flex items-center gap-2 mr-10">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                onClick={handleAudioToggle}
                className={cn(
                  "relative h-8 w-8 text-sm after:content-[''] after:absolute after:-inset-2 after:rounded-full after:md:hidden",
                  isAudioInitialized && !audioError && "bg-accent"
                )}
                disabled={isTogglingAudio}
                aria-pressed={isAudioInitialized && !audioError}
                aria-label={isTogglingAudio ? "Processing audio..." : (isAudioInitialized && !audioError ? "Stop Audio Input" : (audioError ? "Retry Audio Initialization" : "Start Audio Input"))}
              >
                {isTogglingAudio ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : isAudioInitialized && !audioError ? (
                  <Mic className="h-5 w-5 text-success" />
                ) : (
                  <MicOff className="h-5 w-5 text-destructive" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isTogglingAudio ? "Processing audio..." : isAudioInitialized && !audioError ? 'Stop Audio Input' : (audioError ? 'Retry Audio Initialization' : 'Start Audio Input')}</p>
              {audioError && !isAudioInitialized && <p className="text-destructive mt-1">Error: {audioError}</p>}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                onClick={handleWebcamToggle}
                className={cn(
                  "relative h-8 w-8 text-sm after:content-[''] after:absolute after:-inset-2 after:rounded-full after:md:hidden",
                  settings.showWebcam && "bg-accent"
                )}
                disabled={isTogglingWebcam}
                aria-pressed={settings.showWebcam}
                aria-label={settings.showWebcam ? "Stop Webcam" : "Start Webcam"}
              >
                {isTogglingWebcam ? <Loader2 className="h-5 w-5 animate-spin" /> : settings.showWebcam ? <Camera className="h-5 w-5 text-info" /> : <CameraOff className="h-5 w-5 text-muted-foreground" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{settings.showWebcam ? 'Stop Webcam' : 'Start Webcam'}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </header>
      {audioError && !isAudioInitialized && <p className="p-2 text-xs text-destructive bg-destructive/20 text-center">Audio Error: {audioError}. Check mic permissions & selection.</p>}

      <ScrollArea className="flex-1 min-h-0">
        <div
          className="overflow-x-hidden control-panel-content-wrapper"
          style={{
            maxWidth: 'var(--sidebar-width)',
            width: '100%'
          }}
        >
          <Accordion
            type="multiple"
            defaultValue={['presets', 'audio-engine', 'ai-visual-overlay-mixer']} /* Keep audio-engine and AI overlay mixer open */
            className="w-full py-4 space-y-2"
          >
            <PresetSelector value="presets" />
            <AudioControls
              value="audio-engine"
              audioInputDevices={audioInputDevices}
              isAudioToggling={isTogglingAudio || isTogglingWebcam} // Disable if either is toggling
            />
            <VisualControls value="visual-output" />
            <LogoAnimationControls value="logo-animation" />
            <WebcamControls value="webcam-layer" />
            <AiPresetChooser value="ai-preset-chooser" />
            <PaletteGenie value="ai-palette-genie" />
            <AmbianceGenerator value="ai-ambiance-generator" />
            <ProceduralAssetsGenerator value="ai-procedural-assets" />
            <AiVisualOverlayMixer value="ai-visual-overlay-mixer" />
            <OtherControls value="system-safety" />
          </Accordion>
        </div>
      </ScrollArea>
      <footer className="p-2 border-t border-control-panel-border text-center">
        <p className="text-xs text-muted-foreground">
          &copy;{' '}
          <span style={{ fontFamily: 'var(--font-torus-variations, monospace)' }}>
            <span style={{ color: SIXR_S_COLOR }}>S</span>
            <span style={{ color: SIXR_I_COLOR }}>I</span>
            <span style={{ color: SIXR_X_COLOR }}>X</span>
            <span style={{ color: SIXR_R_COLOR }}>R</span>
          </span>{' '}
          Immersive Storytelling Lab {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  );
}
