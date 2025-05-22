
"use client";

import { useEffect, useState } from 'react';
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
import { SIXR_S_COLOR, SIXR_I_COLOR, SIXR_X_COLOR, SIXR_R_COLOR, TORUS_FONT_FAMILY } from '@/lib/brandingConstants';
import { cn } from '@/lib/utils';

export function ControlPanelView() {
  const { initializeAudio, stopAudioAnalysis, isInitialized, error: audioError } = useAudioAnalysis();
  const { settings, updateSetting } = useSettings();
  const [isTogglingAudio, setIsTogglingAudio] = useState(false);
  const [isTogglingWebcam, setIsTogglingWebcam] = useState(false);

  useEffect(() => {
    // Welcome Toast Logic
    if (typeof window !== 'undefined') {
      const alreadyWelcomed = localStorage.getItem('sixrVisionWelcomed');
      if (!alreadyWelcomed) {
        toast({
          title: "Welcome to SIXR Vision!",
          description: "Grant microphone & camera permissions (buttons in header) to begin. Explore presets & controls on the right.",
          duration: 9000,
        });
        localStorage.setItem('sixrVisionWelcomed', 'true');
      }
    }
    // REMOVED auto-initialization useEffect for audio and webcam
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const handleAudioToggle = async () => {
    if (isTogglingAudio) return;
    console.log("ControlPanelView: Toggling audio. Current isInitialized:", isInitialized, "isTogglingAudio:", isTogglingAudio);
    setIsTogglingAudio(true);
    if (isInitialized) {
      await stopAudioAnalysis();
    } else {
      await initializeAudio();
    }
    setIsTogglingAudio(false);
    console.log("ControlPanelView: Audio toggle finished. isInitialized will update on next render.");
  };

  const handleWebcamToggle = () => {
    if (isTogglingWebcam) return;
    console.log("ControlPanelView: Toggling webcam. Current state:", settings.showWebcam);
    setIsTogglingWebcam(true);
    updateSetting('showWebcam', !settings.showWebcam);
    setIsTogglingWebcam(false);
    console.log("ControlPanelView: Webcam toggle finished. New showWebcam setting:", !settings.showWebcam);
  };

  return (
    <div className="h-full flex flex-col bg-control-panel-background text-control-panel-foreground">
      <header className="p-4 border-b border-control-panel-border flex justify-between items-center">
        <div className="flex items-center">
          <SixrLogo className="h-6 w-auto mr-2" />
          <h2 className="text-lg font-semibold" style={{ fontFamily: TORUS_FONT_FAMILY }}>
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
                  isInitialized && !audioError && "bg-accent"
                )}
                disabled={isTogglingAudio}
                aria-pressed={isInitialized && !audioError}
                aria-label={isInitialized && !audioError ? "Stop Audio Input" : (audioError ? "Retry Audio Initialization" : "Start Audio Input")}
              >
                {isTogglingAudio ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : isInitialized && !audioError ? (
                  <Mic className="h-5 w-5 text-success" />
                ) : (
                  <MicOff className="h-5 w-5 text-destructive" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isTogglingAudio ? "Processing..." : isInitialized && !audioError ? 'Stop Audio Input' : (audioError ? 'Retry Audio Initialization' : 'Start Audio Input')}</p>
              {audioError && !isInitialized && <p className="text-destructive mt-1">Error: {audioError}</p>}
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
      {audioError && !isInitialized && <p className="p-2 text-xs text-destructive bg-destructive/20 text-center">Audio Error: {audioError}. Please check microphone permissions.</p>}
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
            defaultValue={['presets', 'audio-engine', 'visual-output']}
            className="w-full py-4 space-y-1"
          >
            <PresetSelector value="presets" />
            <AudioControls value="audio-engine" />
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
          <span style={{ fontFamily: TORUS_FONT_FAMILY }}>
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
