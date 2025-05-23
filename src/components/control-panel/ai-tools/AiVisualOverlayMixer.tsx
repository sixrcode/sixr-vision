
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
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
import { Layers, Wand2, Loader2 } from 'lucide-react';
import { VALID_BLEND_MODES } from '@/types';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ControlHint } from '../ControlHint';
import { LabelledSwitchControl } from '../common/LabelledSwitchControl';
import { AiSuggestedPromptDisplay } from '../common/AiSuggestedPromptDisplay';


type AiVisualOverlayMixerProps = {
  value: string; // For AccordionItem
};

export function AiVisualOverlayMixer({ value }: AiVisualOverlayMixerProps) {
  const { settings, updateSetting } = useSettings();
  const { audioData } = useAudioData();
  const { currentScene } = useScene();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [localPrompt, setLocalPrompt] = useState(settings.aiOverlayPrompt);
  const [initialGenerationDone, setInitialGenerationDone] = useState(false);
  
  useEffect(() => {
    setLocalPrompt(settings.aiOverlayPrompt);
  }, [settings.aiOverlayPrompt]);

  // Effect for initial overlay generation on load
  useEffect(() => {
    if (!initialGenerationDone && currentScene && audioData.rms > 0.005 && !settings.aiGeneratedOverlayUri) {
      console.log("AiVisualOverlayMixer: Attempting initial AI overlay generation.");
      // Use the default prompt from settings for initial generation
      handleGenerateOverlay(settings.aiOverlayPrompt, true); // Pass true to auto-enable after generation
      setInitialGenerationDone(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentScene, audioData.rms, initialGenerationDone, settings.aiGeneratedOverlayUri, settings.aiOverlayPrompt]);


  const handleGenerateOverlay = async (promptToUse: string = localPrompt, autoEnableAfterSuccess: boolean = false) => {
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
        if (error.message.toLowerCase().includes("500 internal server error") || error.message.toLowerCase().includes("internal error has occurred")) {
          description = "AI service encountered an internal error. This is often temporary. Please try again in a few moments, or try a different prompt.";
        } else if (error.message.toLowerCase().includes("rate limit")) {
          description = "AI service rate limit hit. Please wait before trying again or enable periodic regeneration with a longer interval.";
        }
      }
      toast({ title: 'Overlay Generation Failed', description, variant: 'destructive' });
      updateSetting('aiGeneratedOverlayUri', null); // Clear URI on failure
      if (autoEnableAfterSuccess) { // If auto-enable was true, turn it off on failure
         updateSetting('enableAiOverlay', false);
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ControlPanelSection title="AI: Visual Overlay Mixer" value={value}>
      <div className="space-y-3">
        <LabelledSwitchControl
          labelContent="Enable AI Overlay"
          labelHtmlFor="enable-ai-overlay-switch"
          switchId="enable-ai-overlay-switch"
          checked={settings.enableAiOverlay}
          onCheckedChange={(checked) => updateSetting('enableAiOverlay', checked)}
          tooltipContent={<p>Toggles the visibility of the AI-generated visual overlay on the main visualizer.</p>}
          switchProps={{ disabled: !settings.aiGeneratedOverlayUri && !isLoading }} 
          switchAriaLabel="Toggle Enable AI Overlay"
        />

        <div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Label htmlFor="ai-overlay-prompt">Overlay Prompt</Label>
            </TooltipTrigger>
            <TooltipContent>
              <p>Describe the visual style or elements for the AI-generated overlay.</p>
              <ControlHint>e.g., "{DEFAULT_SETTINGS.aiOverlayPrompt}"</ControlHint>
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
            onUsePrompt={(prompt) => {
              setLocalPrompt(prompt);
            }}
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
          {isLoading ? 'Generating Overlay...' : 'Generate Overlay'}
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
              className="rounded border object-cover border-border"
              data-ai-hint="generated overlay"
            />
          </div>
        )}

        {settings.enableAiOverlay && settings.aiGeneratedOverlayUri && (
          <>
            <div className="space-y-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Label htmlFor="ai-overlay-opacity-slider">Overlay Opacity ({settings.aiOverlayOpacity.toFixed(2)})</Label>
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
                disabled={isLoading || !settings.enableAiOverlay}
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
                disabled={isLoading || !settings.enableAiOverlay}
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

    