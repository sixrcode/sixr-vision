
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
import { Layers, Wand2, Loader2, RefreshCw } from 'lucide-react';
import { VALID_BLEND_MODES } from '@/types';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ControlHint } from '../ControlHint';
import { LabelledSwitchControl } from '../common/LabelledSwitchControl';
import { AiSuggestedPromptDisplay } from '../common/AiSuggestedPromptDisplay';
import { DEFAULT_SETTINGS } from '@/lib/constants';


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
  const initialGenerationAttemptedRef = useRef(false); // Use ref to avoid re-triggering effect

  useEffect(() => {
    setLocalPrompt(settings.aiOverlayPrompt);
  }, [settings.aiOverlayPrompt]);

  const handleGenerateOverlay = useCallback(async (promptToUse: string, autoEnableAfterSuccess: boolean = false) => {
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
      if (autoEnableAfterSuccess && !settings.enableAiOverlay) {
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
  }, [audioData, currentScene, settings.enableAiOverlay, updateSetting, toast, setIsLoading]);


  // Effect for initial overlay generation on load
  useEffect(() => {
    if (!initialGenerationAttemptedRef.current && currentScene && !settings.aiGeneratedOverlayUri && !isLoading) {
      console.log("AiVisualOverlayMixer: Attempting initial AI overlay generation.");
      handleGenerateOverlay(settings.aiOverlayPrompt || DEFAULT_SETTINGS.aiOverlayPrompt, true); 
      initialGenerationAttemptedRef.current = true;
    }
  }, [currentScene, settings.aiGeneratedOverlayUri, isLoading, handleGenerateOverlay, settings.aiOverlayPrompt]);


  // Effect for periodic overlay regeneration
  useEffect(() => {
    let intervalId: NodeJS.Timeout | undefined;

    if (settings.enableAiOverlay && settings.enablePeriodicAiOverlay && initialGenerationAttemptedRef.current) {
      console.log(`Setting up periodic overlay regeneration every ${settings.aiOverlayRegenerationInterval} seconds.`);
      intervalId = setInterval(() => {
        if (!isLoading) {
          console.log("Periodic AI overlay regeneration triggered.");
          // Use the current prompt from settings for regeneration
          handleGenerateOverlay(settings.aiOverlayPrompt || DEFAULT_SETTINGS.aiOverlayPrompt, false);
        }
      }, settings.aiOverlayRegenerationInterval * 1000);
    }

    return () => {
      if (intervalId) {
        console.log("Clearing periodic overlay regeneration interval.");
        clearInterval(intervalId);
      }
    };
  }, [
    settings.enableAiOverlay,
    settings.enablePeriodicAiOverlay,
    settings.aiOverlayRegenerationInterval,
    settings.aiOverlayPrompt, 
    isLoading,
    handleGenerateOverlay // Added handleGenerateOverlay to dependencies
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
        
        <Button onClick={() => handleGenerateOverlay(localPrompt, !settings.enableAiOverlay)} disabled={isLoading || !currentScene} className="w-full">
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Layers className="mr-2 h-4 w-4" />
          )}
          {isLoading ? 'Generating...' : 'Generate New Overlay'}
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

        {settings.enableAiOverlay && (
          <>
            <LabelledSwitchControl
              labelContent="Enable Periodic Regeneration"
              labelHtmlFor="enable-periodic-ai-overlay-switch"
              switchId="enable-periodic-ai-overlay-switch"
              checked={settings.enablePeriodicAiOverlay}
              onCheckedChange={(checked) => updateSetting('enablePeriodicAiOverlay', checked)}
              tooltipContent={<p>Automatically regenerate the overlay at set intervals.</p>}
              containerClassName="mt-3"
              switchProps={{ disabled: isLoading }}
              switchAriaLabel="Toggle Enable Periodic Overlay Regeneration"
            />

            {settings.enablePeriodicAiOverlay && (
              <div className="space-y-1 mt-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Label htmlFor="ai-overlay-regen-interval-slider">
                      Regeneration Interval ({settings.aiOverlayRegenerationInterval}s)
                    </Label>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>How often the AI overlay should regenerate, in seconds.</p>
                    <ControlHint>Shorter intervals are more dynamic but use more API calls.</ControlHint>
                  </TooltipContent>
                </Tooltip>
                <Slider
                  id="ai-overlay-regen-interval-slider"
                  min={15} 
                  max={120} 
                  step={5}
                  value={[settings.aiOverlayRegenerationInterval]}
                  onValueChange={([val]) => updateSetting('aiOverlayRegenerationInterval', val)}
                  disabled={isLoading}
                  aria-label={`AI Overlay Regeneration Interval: ${settings.aiOverlayRegenerationInterval} seconds`}
                />
              </div>
            )}
          </>
        )}

        {settings.enableAiOverlay && settings.aiGeneratedOverlayUri && (
          <>
            <div className="space-y-1 mt-3">
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

