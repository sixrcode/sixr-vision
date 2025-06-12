
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useSettingsStore } from '@/store/settingsStore';
import { useAudioDataStore } from '@/store/audioDataStore';
import { useSceneStore } from '@/store/sceneStore';
import { generateVisualOverlay, type GenerateVisualOverlayInput, type GenerateVisualOverlayOutput } from '@/ai/flows/generate-visual-overlay';
import { ControlPanelSection } from '../ControlPanelSection';
import { LabelledSwitchControl } from '../common/LabelledSwitchControl';
import { ControlHint } from '../ControlHint';
import { WandSparkles, Loader2 } from 'lucide-react';
import { VALID_BLEND_MODES } from '@/types/state';
import type { GlobalCompositeOperation } from '@/types/state';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

type AiVisualOverlayMixerProps = {
  value: string; // For AccordionItem
};

export function AiVisualOverlayMixer({ value }: AiVisualOverlayMixerProps) {
  const {
    enableAiOverlay,
    aiGeneratedOverlayUri,
    aiOverlayOpacity,
    aiOverlayBlendMode,
    aiOverlayPrompt,
    enablePeriodicAiOverlay,
    aiOverlayRegenerationInterval,
    updateSetting,
  } = useSettingsStore(
    (state) => ({
      enableAiOverlay: state.enableAiOverlay,
      aiGeneratedOverlayUri: state.aiGeneratedOverlayUri,
      aiOverlayOpacity: state.aiOverlayOpacity,
      aiOverlayBlendMode: state.aiOverlayBlendMode,
      aiOverlayPrompt: state.aiOverlayPrompt,
      enablePeriodicAiOverlay: state.enablePeriodicAiOverlay,
      aiOverlayRegenerationInterval: state.aiOverlayRegenerationInterval,
      updateSetting: state.updateSetting,
    })
  );

  const audioData = useAudioDataStore(
    (state) => ({
      bassEnergy: state.bassEnergy,
      midEnergy: state.midEnergy,
      trebleEnergy: state.trebleEnergy,
      rms: state.rms,
      bpm: state.bpm,
    })
  );
  const currentSceneId = useSceneStore((state) => state.currentSceneId);
  const scenes = useSceneStore((state) => state.scenes);
  const currentScene = scenes.find(s => s.id === currentSceneId);
  const currentSceneName = currentScene?.name || "Unknown Scene";

  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const periodicIntervalRef =  useRef<NodeJS.Timeout | null>(null);

  const handleGenerateOverlay = useCallback(async () => {
    if (!aiOverlayPrompt.trim()) {
      toast({ title: 'Prompt required', description: 'Please enter a prompt for the overlay.', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    try {
      const input: GenerateVisualOverlayInput = {
        prompt: aiOverlayPrompt,
        audioContext: {
            bassEnergy: audioData.bassEnergy,
            midEnergy: audioData.midEnergy,
            trebleEnergy: audioData.trebleEnergy,
            rms: audioData.rms,
            bpm: audioData.bpm,
        },
        currentSceneName: currentSceneName,
      };
      const result: GenerateVisualOverlayOutput = await generateVisualOverlay(input);
      updateSetting('aiGeneratedOverlayUri', result.overlayImageDataUri);
      if (!enableAiOverlay) {
        updateSetting('enableAiOverlay', true);
      }
      toast({
        title: 'AI Overlay Generated',
        description: 'Visual overlay created. Enable it to see!',
      });
    } catch (error) {
      console.error('Error generating AI visual overlay:', error);
      toast({
        title: 'Error Generating Overlay',
        description: error instanceof Error ? error.message : 'Failed to generate overlay. See console for details.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [aiOverlayPrompt, audioData, currentSceneName, updateSetting, toast, enableAiOverlay]);

  useEffect(() => {
    if (periodicIntervalRef.current) {
      clearInterval(periodicIntervalRef.current);
      periodicIntervalRef.current = null;
    }

    if (enableAiOverlay && enablePeriodicAiOverlay && aiOverlayRegenerationInterval > 0) {
      handleGenerateOverlay(); 
      periodicIntervalRef.current = setInterval(() => {
        if (audioData.rms > 0.01 || audioData.bpm > 0){ // Check if audio is active
            handleGenerateOverlay();
        }
      }, aiOverlayRegenerationInterval * 1000);
    }

    return () => {
      if (periodicIntervalRef.current) {
        clearInterval(periodicIntervalRef.current);
      }
    };
  }, [enableAiOverlay, enablePeriodicAiOverlay, aiOverlayRegenerationInterval, handleGenerateOverlay, audioData.rms, audioData.bpm]);


  return (
    <ControlPanelSection title="AI: Visual Overlay Mixer" value={value}>
      <div className="space-y-3">
        <LabelledSwitchControl
          labelContent="Enable AI Visual Overlay"
          labelHtmlFor="enable-ai-overlay-switch"
          switchId="enable-ai-overlay-switch"
          checked={enableAiOverlay}
          onCheckedChange={(checked) => updateSetting('enableAiOverlay', checked)}
          tooltipContent="Toggles the visibility of the AI-generated visual overlay on the main visualizer."
        />

        {enableAiOverlay && (
          <>
            <div className="space-y-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Label htmlFor="ai-overlay-opacity-slider">Opacity ({aiOverlayOpacity.toFixed(2)})</Label>
                </TooltipTrigger>
                <TooltipContent>Adjusts the transparency of the AI-generated overlay.</TooltipContent>
              </Tooltip>
              <Slider
                id="ai-overlay-opacity-slider"
                min={0} max={1} step={0.01}
                value={[aiOverlayOpacity]}
                onValueChange={([val]) => updateSetting('aiOverlayOpacity', val)}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-1">
               <Tooltip>
                <TooltipTrigger asChild>
                  <Label htmlFor="ai-overlay-blend-mode-select">Blend Mode (Canvas 2D)</Label>
                </TooltipTrigger>
                <TooltipContent>Sets how the AI overlay blends. Note: Full WebGL blend mode support is more complex.</TooltipContent>
              </Tooltip>
              <Select
                value={aiOverlayBlendMode}
                onValueChange={(val) => updateSetting('aiOverlayBlendMode', val as GlobalCompositeOperation)}
                disabled={isLoading}
              >
                <SelectTrigger id="ai-overlay-blend-mode-select">
                  <SelectValue placeholder="Select blend mode" />
                </SelectTrigger>
                <SelectContent>
                  {VALID_BLEND_MODES.map(mode => (
                    <SelectItem key={mode} value={mode}>{mode.charAt(0).toUpperCase() + mode.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <ControlHint>Current WebGL overlay uses transparency; full blend modes are a 2D Canvas concept.</ControlHint>
            </div>
          </>
        )}

        <div className="space-y-1">
           <Tooltip>
            <TooltipTrigger asChild>
                <Label htmlFor="ai-overlay-prompt-input">Overlay Prompt</Label>
            </TooltipTrigger>
            <TooltipContent>Describe the visual style or elements for the AI overlay. Theme: "Cosmic Grapevines".</TooltipContent>
          </Tooltip>
          <Input
            id="ai-overlay-prompt-input"
            placeholder="e.g., 'cosmic vines, purple grapes'"
            value={aiOverlayPrompt}
            onChange={(e) => updateSetting('aiOverlayPrompt', e.target.value)}
            disabled={isLoading}
          />
          <ControlHint>Think "Cosmic Grapevines" meets Afrofuturism.</ControlHint>
        </div>
        
        <Tooltip>
            <TooltipTrigger asChild>
                <Button onClick={handleGenerateOverlay} disabled={isLoading || !aiOverlayPrompt.trim()} className="w-full">
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <WandSparkles className="mr-2 h-4 w-4" />}
                {isLoading ? 'Generating...' : 'Generate Overlay'}
                </Button>
            </TooltipTrigger>
            <TooltipContent>Generates a new visual overlay based on the current prompt, audio, and scene. Requires a prompt.</TooltipContent>
        </Tooltip>

        {aiGeneratedOverlayUri && enableAiOverlay && (
          <div className="mt-2 space-y-1">
            <Label>Current Overlay Preview:</Label>
            <Image
              src={aiGeneratedOverlayUri}
              alt="AI Generated Overlay Preview"
              width={100} height={100}
              className="rounded border border-border object-cover bg-muted"
              data-ai-hint="generated overlay"
            />
          </div>
        )}

        <div className="pt-2 border-t border-sidebar-border mt-4">
            <LabelledSwitchControl
                labelContent="Enable Periodic Regeneration"
                labelHtmlFor="enable-periodic-ai-overlay-switch"
                switchId="enable-periodic-ai-overlay-switch"
                checked={enablePeriodicAiOverlay}
                onCheckedChange={(checked) => updateSetting('enablePeriodicAiOverlay', checked)}
                tooltipContent="If enabled, the AI overlay will regenerate automatically at the specified interval when the main overlay is active."
                disabled={isLoading}
            />
            {enablePeriodicAiOverlay && (
                 <div className="space-y-1 mt-2">
                    <Tooltip>
                        <TooltipTrigger asChild>
                             <Label htmlFor="ai-overlay-interval-input">Regen. Interval (sec, min 15)</Label>
                        </TooltipTrigger>
                        <TooltipContent>How often the overlay should regenerate. Minimum 15 seconds. Requires "Enable AI Visual Overlay" to be active.</TooltipContent>
                    </Tooltip>
                    <Input
                        id="ai-overlay-interval-input"
                        type="number"
                        min={15}
                        max={300}
                        step={5}
                        value={aiOverlayRegenerationInterval}
                        onChange={(e) => updateSetting('aiOverlayRegenerationInterval', Math.max(15, parseInt(e.target.value,10) || 15))}
                        disabled={isLoading || !enablePeriodicAiOverlay}
                    />
                 </div>
            )}
        </div>
      </div>
    </ControlPanelSection>
  );
}
