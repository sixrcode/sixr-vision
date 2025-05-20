
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
import { AiVisualOverlayMixer } from './ai-tools/AiVisualOverlayMixer'; // Import new component
import { LogoAnimationControls } from './LogoAnimationControls';
import { OtherControls } from './OtherControls';
import { useAudioAnalysis } from '@/hooks/useAudioAnalysis';
import { useSettings } from '@/providers/SettingsProvider';
import { useEffect } from 'react';
import { Power, Mic, Camera } from 'lucide-react';
import { Accordion } from '@/components/ui/accordion';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function ControlPanelView() {
  const { initializeAudio, isInitialized, error } = useAudioAnalysis();
  const { settings } = useSettings();

  useEffect(() => {
    if (!isInitialized && !error) {
      initializeAudio();
    }
  }, [isInitialized, initializeAudio, error]);

  const sColor = "rgb(254, 190, 15)";
  const iColor = "rgb(51, 197, 244)";
  const xColor = "rgb(235, 26, 115)";
  const rColor = "rgb(91, 185, 70)";
  const torusFontFamily = "'Torus Variations', var(--font-geist-mono), monospace";

  return (
    <div className="h-full flex flex-col text-[hsl(var(--control-panel-foreground))]">
      <header className="p-4 border-b border-[hsl(var(--control-panel-border))] flex justify-between items-center">
        <div className="flex items-center">
          <SixrLogo className="h-6 w-auto mr-2" />
          <h2 className="text-lg font-semibold">
            Vision
          </h2>
        </div>

        {/* Added mr-10 (40px) to this container to create visual space from the global SidebarTrigger */}
        <div className="flex items-center gap-3 mr-10">
          {isInitialized && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center text-sm text-green-400 cursor-default">
                  <Mic className="h-4 w-4" />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Audio input is active</p>
              </TooltipContent>
            </Tooltip>
          )}
          {settings.showWebcam && (
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
          {!isInitialized && (
            <Button
              size="sm"
              onClick={initializeAudio}
              variant={error ? "destructive" : "default"}>
              <Power className="mr-2 h-4 w-4" />
              {error ? "Retry Audio" : "Initialize Audio"}
            </Button>
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
