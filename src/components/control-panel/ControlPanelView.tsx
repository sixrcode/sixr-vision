
"use client";

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
import { useEffect, useState } from 'react';
import { Power, Mic, MicOff, Camera, Loader2 } from 'lucide-react';
import { Accordion } from '@/components/ui/accordion';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSettings } from '@/providers/SettingsProvider';


export function ControlPanelView() {
  const { initializeAudio, stopAudioAnalysis, isInitialized, error } = useAudioAnalysis();
  const { settings, updateSetting } = useSettings();
  const [isTogglingAudio, setIsTogglingAudio] = useState(false);


  useEffect(() => {
    // Attempt to initialize audio automatically on mount
    if (!isInitialized && !error) {
        console.log("ControlPanelView: Attempting initial audio initialization on mount.");
        // initializeAudio(); // User will click button
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount


  const sColor = "rgb(254, 190, 15)";
  const iColor = "rgb(51, 197, 244)";
  const xColor = "rgb(235, 26, 115)";
  const rColor = "rgb(91, 185, 70)";
  const torusFontFamily = "'Torus Variations', var(--font-geist-mono), monospace";

  const handlePowerToggle = async () => {
    console.log("handlePowerToggle called. isInitialized:", isInitialized, "isTogglingAudio:", isTogglingAudio);
    if (isTogglingAudio) return; 

    setIsTogglingAudio(true);
    if (isInitialized) {
      console.log("Calling stopAudioAnalysis and disabling webcam...");
      await stopAudioAnalysis();
      updateSetting('showWebcam', false);
    } else {
      console.log("Calling initializeAudio and enabling webcam...");
      await initializeAudio();
      // Only turn on webcam if audio initializes successfully
      // The isInitialized state might not update immediately after initializeAudio() resolves
      // So, we rely on the fact that initializeAudio sets its internal state,
      // and WebcamFeed will react to settings.showWebcam
      updateSetting('showWebcam', true); 
    }
    setIsTogglingAudio(false);
    console.log("handlePowerToggle finished. States will update on next render.");
  };

  return (
    <div className="h-full flex flex-col text-[hsl(var(--control-panel-foreground))]">
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
                onClick={handlePowerToggle}
                className="h-7 w-7 text-sm"
                disabled={isTogglingAudio}
              >
                {isTogglingAudio ? (
                  <Loader2 className="animate-spin" />
                ) : isInitialized ? (
                  <Power className="text-green-400" /> 
                ) : (
                  <Power className="text-destructive" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isTogglingAudio ? "Processing..." : isInitialized ? 'Stop Audio & Webcam' : (error ? 'Retry Audio & Webcam Initialization' : 'Initialize Audio & Webcam')}</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center text-sm cursor-default">
                {isInitialized ? <Mic className="h-4 w-4 text-green-400" /> : <MicOff className="h-4 w-4 text-muted-foreground" />}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isInitialized ? 'Audio input is active' : 'Audio input is inactive'}</p>
              {error && !isInitialized && <p className="text-destructive">Error: {error}</p>}
            </TooltipContent>
          </Tooltip>
          
          {settings.showWebcam && ( // This indicator reacts to the live settings.showWebcam
             <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center text-sm text-sky-400 cursor-default">
                  <Camera className="h-4 w-4" />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Webcam is active</p> 
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </header>
      {error && !isInitialized && <p className="p-2 text-xs text-destructive bg-destructive/20 text-center">Audio Error: {error}. Please check microphone permissions.</p>}
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

