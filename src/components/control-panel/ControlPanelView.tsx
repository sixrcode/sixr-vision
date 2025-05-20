
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

export function ControlPanelView() {
  const { initializeAudio, stopAudioAnalysis, isInitialized, error: audioError } = useAudioAnalysis();
  const { settings, updateSetting } = useSettings();
  const [isTogglingAudio, setIsTogglingAudio] = useState(false);
  const [isTogglingWebcam, setIsTogglingWebcam] = useState(false); 

  const sColor = "rgb(254, 190, 15)";
  const iColor = "rgb(51, 197, 244)";
  const xColor = "rgb(235, 26, 115)";
  const rColor = "rgb(91, 185, 70)";
  const torusFontFamily = "'Torus Variations', var(--font-geist-mono), monospace";

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

    // Auto-initialize Audio and Webcam
    const autoInit = async () => {
      if (!isInitialized && !audioError && !isTogglingAudio) {
        console.log("ControlPanelView: Auto-initializing audio on load.");
        setIsTogglingAudio(true);
        await initializeAudio();
        setIsTogglingAudio(false);
      }
      if (!settings.showWebcam && !isTogglingWebcam) {
         console.log("ControlPanelView: Auto-initializing webcam on load.");
         setIsTogglingWebcam(true);
         updateSetting('showWebcam', true); // This will trigger WebcamFeed's useEffect
         setIsTogglingWebcam(false);
      }
    };
    autoInit();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const handleAudioToggle = async () => {
    if (isTogglingAudio) return;
    console.log("handleAudioToggle called. isInitialized:", isInitialized, "isTogglingAudio:", isTogglingAudio);
    setIsTogglingAudio(true);
    if (isInitialized) {
      console.log("ControlPanelView: Calling stopAudioAnalysis via toggle.");
      await stopAudioAnalysis();
    } else {
      console.log("ControlPanelView: Calling initializeAudio via toggle.");
      await initializeAudio();
    }
    setIsTogglingAudio(false);
    console.log("ControlPanelView: Audio toggle finished. The 'isInitialized' state will update on the next render.");
  };

  const handleWebcamToggle = () => {
    if (isTogglingWebcam) return;
    console.log("ControlPanelView: Toggling webcam via button. Current state:", settings.showWebcam);
    setIsTogglingWebcam(true);
    updateSetting('showWebcam', !settings.showWebcam);
    setIsTogglingWebcam(false);
    console.log("ControlPanelView: Webcam toggle finished.");
  };

  return (
    <div className="h-full flex flex-col text-[hsl(var(--control-panel-foreground))] !bg-control-panel-background">
      <header className="p-4 border-b border-[hsl(var(--control-panel-border))] flex justify-between items-center">
        <div className="flex items-center">
          <SixrLogo className="h-6 w-auto mr-2" />
          <h2 className="text-lg font-semibold" style={{ fontFamily: torusFontFamily }}>
            Vision
          </h2>
        </div>

        <div className="flex items-center gap-3 mr-10">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                onClick={handleAudioToggle}
                className="h-7 w-7 text-sm"
                disabled={isTogglingAudio}
                aria-label={isInitialized ? "Stop Audio Input" : (audioError ? "Retry Audio Initialization" : "Start Audio Input")}
              >
                {isTogglingAudio ? (
                  <Loader2 className="animate-spin" />
                ) : isInitialized ? (
                  <Mic className="text-green-400" />
                ) : (
                  <MicOff className="text-destructive" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isTogglingAudio ? "Processing..." : isInitialized ? 'Stop Audio Input' : (audioError ? 'Retry Audio Initialization' : 'Start Audio Input')}</p>
              {audioError && !isInitialized && <p className="text-destructive mt-1">Error: {audioError}</p>}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                onClick={handleWebcamToggle}
                className="h-7 w-7 text-sm"
                disabled={isTogglingWebcam}
                aria-label={settings.showWebcam ? "Stop Webcam" : "Start Webcam"}
              >
                {isTogglingWebcam ? <Loader2 className="animate-spin" /> : settings.showWebcam ? <Camera className="text-sky-400" /> : <CameraOff className="text-muted-foreground" />}
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
          className="overflow-x-hidden"
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
      <footer className="p-2 border-t border-[hsl(var(--control-panel-border))] text-center">
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          &copy;{' '}
          <span style={{ fontFamily: torusFontFamily }}>
            <span style={{ color: sColor }}>S</span>
            <span style={{ color: iColor }}>I</span>
            <span style={{ color: xColor }}>X</span>
            <span style={{ color: rColor }}>R</span>
          </span>{' '}
          Immersive Storytelling Lab {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  );
}
