
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
import { OtherControls } from './OtherControls';
import { useAudioAnalysis } from '@/hooks/useAudioAnalysis';
import { useEffect } from 'react';
import { Power, Mic } from 'lucide-react';
import { Accordion } from '@/components/ui/accordion';

export function ControlPanelView() {
  const { initializeAudio, isInitialized, error } = useAudioAnalysis();

  // Attempt to initialize audio on mount
  useEffect(() => {
    if (!isInitialized && !error) { // Only attempt if not already initialized and no prior error
      initializeAudio();
    }
  }, [isInitialized, initializeAudio, error]);

  const getButtonState = () => {
    if (isInitialized) {
      return { text: "Audio Active", icon: <Mic className="mr-2 h-4 w-4" />, variant: "default" as "default" | "destructive", disabled: true };
    }
    if (error) {
      return { text: "Retry Init", icon: <Power className="mr-2 h-4 w-4" />, variant: "destructive" as "default" | "destructive", disabled: false };
    }
    return { text: "Initialize Audio", icon: <Power className="mr-2 h-4 w-4" />, variant: "default" as "default" | "destructive", disabled: false };
  };

  const buttonState = getButtonState();

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
        {!isInitialized && (
            <Button size="sm" onClick={initializeAudio} variant={buttonState.variant} disabled={buttonState.disabled}>
              {buttonState.icon} {buttonState.text}
            </Button>
        )}
         {isInitialized && (
             <div className="flex items-center text-sm text-green-400">
                <Mic className="mr-1 h-4 w-4" /> Audio Active
             </div>
         )}
      </header>
      {error && !isInitialized && <p className="p-2 text-xs text-destructive bg-destructive/20 text-center">Audio Error: {error}. Please check microphone permissions.</p>}
      <ScrollArea className="flex-1 min-h-0">
        <div 
          className="overflow-x-hidden" 
          style={{ 
            maxWidth: 'var(--sidebar-width)', 
            width: '100%' /* Ensure it tries to fill up to max-width */ 
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
            <WebcamControls value="webcam-layer" />
            <AiPresetChooser value="ai-preset-chooser" />
            <PaletteGenie value="ai-palette-genie" />
            <ProceduralAssetsGenerator value="ai-procedural-assets" />
            <OtherControls value="system-safety" />
          </Accordion>
        </div>
      </ScrollArea>
      <footer className="p-2 border-t border-[hsl(var(--control-panel-border))] text-center">
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          &copy;{' '}
          <span>
            <span style={{ color: sColor, fontFamily: torusFontFamily }}>S</span>
            <span style={{ color: iColor, fontFamily: torusFontFamily }}>I</span>
            <span style={{ color: xColor, fontFamily: torusFontFamily }}>X</span>
            <span style={{ color: rColor, fontFamily: torusFontFamily }}>R</span>
          </span>{' '}
          Immersive Storytelling Lab {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  );
}
