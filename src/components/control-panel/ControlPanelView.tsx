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
import { Power } from 'lucide-react';

export function ControlPanelView() {
  const { initializeAudio, isInitialized, error } = useAudioAnalysis();

  // Attempt to initialize audio on mount
  useEffect(() => {
    if (!isInitialized) {
      // initializeAudio(); // Auto-init can be aggressive, let's use a button
    }
  }, [isInitialized, initializeAudio]);


  return (
    <div className="h-full flex flex-col text-[hsl(var(--control-panel-foreground))]">
      <header className="p-4 border-b border-[hsl(var(--control-panel-border))] flex justify-between items-center">
        <div className="flex items-center">
          <SixrLogo className="h-6 w-auto mr-2" />
          <h2 className="text-lg font-semibold">SIXR Vision</h2>
        </div>
        {!isInitialized && (
            <Button size="sm" onClick={initializeAudio} variant={error ? "destructive" : "default"}>
              <Power className="mr-2 h-4 w-4" /> {error ? "Retry Init" : "Start Audio"}
            </Button>
        )}
      </header>
      {error && <p className="p-2 text-xs text-destructive bg-destructive/20 text-center">{error}</p>}
      <ScrollArea className="flex-1">
        <div className="py-4 space-y-1"> {/* Reduced space-y for denser packing if needed */}
          <PresetSelector />
          <AudioControls />
          <VisualControls />
          <WebcamControls />
          <AiPresetChooser />
          <PaletteGenie />
          <ProceduralAssetsGenerator />
          <OtherControls />
        </div>
      </ScrollArea>
      <footer className="p-2 border-t border-[hsl(var(--control-panel-border))] text-center">
        <p className="text-xs text-[hsl(var(--muted-foreground))]">&copy; SIXR Systems {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}
