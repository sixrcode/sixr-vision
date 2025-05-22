
"use client";

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useSettings } from '@/providers/SettingsProvider';
import { useAudioData } from '@/providers/AudioDataProvider';
import { useScene } from '@/providers/SceneProvider';
import { generateVisualOverlay, type GenerateVisualOverlayInput, type GenerateVisualOverlayOutput } from '@/ai/flows/generate-visual-overlay';
import { ControlPanelSection } from '../ControlPanelSection';
import { Layers, Wand2, Loader2, Repeat } from 'lucide-react';
import { VALID_BLEND_MODES, type Settings } from '@/types';
import { DEFAULT_SETTINGS } from '@/lib/constants'; // Added import
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ControlHint } from '../ControlHint';
import { LabelledSwitchControl } from '../common/LabelledSwitchControl';
import { AiSuggestedPromptDisplay } from '../common/AiSuggestedPromptDisplay';


type AiVisualOverlayMixerProps = {
  value: string; // For AccordionItem
};

const PERIODIC_REGENERATION_INTERVAL = 45000; // 45 seconds

export function AiVisualOverlayMixer({ value }: AiVisualOverlayMixerProps) {
  const { settings, updateSetting } = useSettings();
  const { audioData } = useAudioData();
  const { currentScene } = useScene();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [localPrompt, setLocalPrompt] = useState(settings.aiOverlayPrompt);
  const [initialGenerationAttempted, setInitialGenerationAttempted] = useState(false);
  
  useEffect(() => {
    setLocalPrompt(settings.aiOverlayPrompt);
  }, [settings.aiOverlayPrompt]);

  const handleGenerateOverlay = useCallback(async (promptToUse: string = localPrompt, autoEnableAfterSuccess: boolean = false): Promise<boolean> => {
    if (!currentScene) {
      toast({ title: 'No Scene Active', description: 'Please select a scene first to provide context for the overlay.', variant: 'destructive' });
      return false;
    }
    if (!promptToUse.trim()) {
      toast({ title: 'Prompt Required', description: 'Please enter a prompt for the overlay.', variant: 'destructive' });
      return false;
    }

    setIsLoading(true);
    try {
      const serializableAudioData = {
        bassEnergy: audioData.bassEnergy,
        midEnergy: audioData.midEnergy,
        trebleEnergy: audioData.trebleEnergy,
        rms: audioData.rms,
        bpm: audioData.bpm,
      };
      const input: GenerateVisualOverlayInput = {
        prompt: promptToUse,
        audioContext: serializableAudioData,
        currentSceneName: currentScene.name,
      };

      console.log("[AI Flow Debug] Generating AI Visual Overlay with prompt:", input.prompt); // Log the prompt

      const result: GenerateVisualOverlayOutput = await generateVisualOverlay(input);
      updateSetting('aiGeneratedOverlayUri', result.overlayImageDataUri);
      updateSetting('aiOverlayPrompt', promptToUse); 
      toast({ title: 'AI Overlay Generated', description: 'Visual overlay created!' });
      if (autoEnableAfterSuccess) {
        updateSetting('enableAiOverlay', true);
      }
      return true;
    } catch (error) {
      console.error('Error generating AI overlay:', error);
      let description = 'Could not generate overlay.';
      if (error instanceof Error) {
        description = error.message;
        if (error.message.includes("500 Internal Server Error") || error.message.includes("internal error has occurred") || error.message.toLowerCase().includes("internal server error")) {
          description = "AI service encountered an internal error. This is often temporary. Please try again in a few moments, or try a different prompt.";
        }
      }
      toast({ title: 'Overlay Generation Failed', description, variant: 'destructive' });
      updateSetting('aiGeneratedOverlayUri', null);
      if (autoEnableAfterSuccess) {
         updateSetting('enableAiOverlay', false);
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [currentScene, audioData, updateSetting, toast, localPrompt]);

  // Initial overlay generation on load - removed auto-generation
  useEffect(() => {
    if (!initialGenerationAttempted && currentScene && audioData.rms > 0.005 && !settings.aiGeneratedOverlayUri && settings.aiOverlayPrompt === DEFAULT_SETTINGS.aiOverlayPrompt) {
      console.log("AiVisualOverlayMixer: Attempting initial AI overlay generation with default SBNF prompt.");
      // No longer auto-generate on load to reduce API errors
      // handleGenerateOverlay(settings.aiOverlayPrompt, true).then(() => {
      //   setInitialGenerationAttempted(true);
      // });
      setInitialGenerationAttempted(true); // Mark as attempted so it doesn't retry
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentScene, audioData.rms, settings.aiGeneratedOverlayUri, settings.aiOverlayPrompt]);


  // Periodic overlay regeneration
  useEffect(() => {
    let intervalId: NodeJS.Timeout | undefined;

    if (settings.enableAiOverlay && settings.enablePeriodicAiOverlay && !isLoading) {
      console.log(`AiVisualOverlayMixer: Starting periodic regeneration every ${PERIODIC_REGENERATION_INTERVAL / 1000}s.`);
      intervalId = setInterval(() => {
        if (!isLoading) { // Double check isLoading before calling
          console.log("AiVisualOverlayMixer: Triggering periodic overlay regeneration.");
          handleGenerateOverlay(settings.aiOverlayPrompt, false); // autoEnable is false as it's already enabled
        }
      }, PERIODIC_REGENERATION_INTERVAL);
    } else {
       console.log("AiVisualOverlayMixer: Periodic regeneration conditions not met or stopping.");
    }

    return () => {
      if (intervalId) {
        console.log("AiVisualOverlayMixer: Clearing periodic regeneration interval.");
        clearInterval(intervalId);
      }
    };
  }, [
    settings.enableAiOverlay, 
    settings.enablePeriodicAiOverlay, 
    settings.aiOverlayPrompt, 
    handleGenerateOverlay,
    isLoading
  ]);


  return (
    <ControlPanelSection title="AI: Visual Overlay Mixer" value={value}>
      <div className="space-y-3">
        <LabelledSwitchControl
          labelContent="Enable AI Overlay"
          labelHtmlFor="enable-ai-overlay-switch"
          switchId="enable-ai-overlay-switch"
          checked={settings.enableAiOverlay}
          onCheckedChange={(checked) => updateSetting('enableAiOverlay', checked)}
          tooltipContent={<p>Toggles the visibility of the AI-generated visual overlay.</p>}
          switchProps={{ disabled: !settings.aiGeneratedOverlayUri || isLoading }}
          switchAriaLabel="Toggle Enable AI Overlay"
        />

        {settings.enableAiOverlay && (
           <LabelledSwitchControl
            labelContent="Periodic Regeneration"
            labelHtmlFor="enable-periodic-ai-overlay-switch"
            switchId="enable-periodic-ai-overlay-switch"
            checked={settings.enablePeriodicAiOverlay}
            onCheckedChange={(checked) => updateSetting('enablePeriodicAiOverlay', checked)}
            tooltipContent={<p>If enabled, the AI overlay will automatically regenerate every {PERIODIC_REGENERATION_INTERVAL/1000} seconds using the current prompt and audio context.</p>}
            switchProps={{ disabled: isLoading }}
            containerClassName="mt-2"
            switchAriaLabel="Toggle Periodic AI Overlay Regeneration"
          />
        )}

        <div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Label htmlFor="ai-overlay-prompt">Overlay Prompt</Label>
            </TooltipTrigger>
            <TooltipContent>
              <p>Describe the visual style or elements for the AI-generated overlay.</p>
              <ControlHint>e.g., "swirling cosmic dust", "geometric neon lines", "water ripples"</ControlHint>
            </TooltipContent>
          </Tooltip>
          <Input
            id="ai-overlay-prompt"
            value={localPrompt}
            onChange={(e) => setLocalPrompt(e.target.value)}
            placeholder={DEFAULT_SETTINGS.aiOverlayPrompt}
            disabled={isLoading}
          />
          <AiSuggestedPromptDisplay
            suggestedPrompt={settings.lastAISuggestedAssetPrompt}
            onUsePrompt={setLocalPrompt}
            isLoading={isLoading}
            icon={Wand2}
            labelText="Suggestion:"
            containerClassName="mt-1.5 p-1.5"
          />
        </div>
        
        <Button onClick={() => handleGenerateOverlay(localPrompt, false)} disabled={isLoading || !currentScene} className="w-full">
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Layers className="mr-2 h-4 w-4" />
          )}
          {isLoading ? 'Generating Overlay...' : 'Generate/Update Overlay'}
        </Button>
        {!currentScene && <ControlHint className="text-destructive text-center">Select a scene first to generate an overlay.</ControlHint>}

        {settings.aiGeneratedOverlayUri && (
          <div className="mt-2 space-y-1">
            <Label>Generated Overlay Preview:</Label>
            <Image
              src={settings.aiGeneratedOverlayUri}
              alt="AI Generated Overlay"
              width={100}
              height={100}
              className="rounded border object-cover"
              data-ai-hint="generated overlay"
            />
          </div>
        )}

        {settings.enableAiOverlay && settings.aiGeneratedOverlayUri && (
          <>
            <div className="space-y-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Label htmlFor="ai-overlay-opacity-slider">Opacity ({settings.aiOverlayOpacity.toFixed(2)})</Label>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Controls the transparency of the AI-generated overlay.</p>
                </TooltipContent>
              </Tooltip>
              <Slider
                id="ai-overlay-opacity-slider"
                min={0}
                max={1}
                step={0.01}
                value={[settings.aiOverlayOpacity]}
                onValueChange={([val]) => updateSetting('aiOverlayOpacity', val)}
                disabled={isLoading}
                aria-label={`AI Overlay Opacity: ${settings.aiOverlayOpacity.toFixed(2)}`}
              />
            </div>

            <div className="space-y-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Label htmlFor="ai-overlay-blend-mode-select">Blend Mode</Label>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Determines how the AI overlay mixes with the main visualizer scene.</p>
                </TooltipContent>
              </Tooltip>
              <Select
                value={settings.aiOverlayBlendMode}
                onValueChange={(val) => updateSetting('aiOverlayBlendMode', val as CanvasRenderingContext2D['globalCompositeOperation'])}
                disabled={isLoading}
              >
                <SelectTrigger id="ai-overlay-blend-mode-select" aria-label="Select AI Overlay Blend Mode">
                  <SelectValue placeholder="Select blend mode" />
                </SelectTrigger>
                <SelectContent>
                  {VALID_BLEND_MODES.map(mode => (
                    <SelectItem key={mode} value={mode}>{mode.charAt(0).toUpperCase() + mode.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}
      </div>
    </ControlPanelSection>
  );
}

