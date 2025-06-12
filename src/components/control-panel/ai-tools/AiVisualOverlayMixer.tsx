
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
import { VALID_BLEND_MODES as blendModesArray } from '@/types'; // Import the array
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ControlHint } from '../ControlHint';
import { LabelledSwitchControl } from '../common/LabelledSwitchControl';
import { AiSuggestedPromptDisplay } from '../common/AiSuggestedPromptDisplay';
import { DEFAULT_SETTINGS } from '@/lib/constants'; // Added missing import
import { Layers, Loader2 } from 'lucide-react';
import { addLogEntry } from '@/services/rehearsalLogService';
import { ControlPanelSection } from '../ControlPanelSection'; // Added import

type AiVisualOverlayMixerProps = {
  value: string; // For AccordionItem
};

export function AiVisualOverlayMixer({ value }: AiVisualOverlayMixerProps) {
  const { settings, updateSetting } = useSettings();
  const { audioData } = useAudioData();
  const { currentScene } = useScene();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const initialGenerationAttempted = useRef(false);
  const periodicUpdateIntervalId = useRef<NodeJS.Timeout | null>(null);

 useEffect(() => {
 // Update localPrompt if the global setting changes from elsewhere
 if (settings.aiOverlayPrompt !== localPrompt) {
 setLocalPrompt(settings.aiOverlayPrompt || DEFAULT_SETTINGS.aiOverlayPrompt);
    }
  }, [settings.aiOverlayPrompt, localPrompt]);

  const handleGenerateOverlay = useCallback(async (promptToUse: string) => {
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
      if (promptToUse !== settings.aiOverlayPrompt) {
        updateSetting('aiOverlayPrompt', promptToUse);
      }
 toast({ title: 'AI Overlay Generated', description: 'Visual overlay created!', variant: 'success' });
      
      try {
        await addLogEntry('ai_overlay_generated', { prompt: promptToUse, sceneId: currentScene.id });
      } catch (e) {
         console.warn("Failed to log AI overlay generation:", e);
      }
      
      // Automatically enable overlay if it wasn't already, after successful generation
      if (!settings.enableAiOverlay) {
        updateSetting('enableAiOverlay', true);
      }
      return true;
    } catch (error) {
      console.error('Error generating AI overlay:', error);
      let description = 'Could not generate overlay.';
      if (error instanceof Error) {
        description = error.message; // Keep original message as fallback
 if (error.message.toLowerCase().includes('500 internal server error') || error.message.toLowerCase().includes('internal error has occurred')) {
          description = 'AI service encountered an internal error. This is often temporary. Please try again in a few moments, or try a different prompt.'
        } else if (error.message.toLowerCase().includes("rate limit")) {
          description = "AI service rate limit hit. Please wait before trying again or enable periodic regeneration with a longer interval.";
        }
      }
      toast({ title: 'Overlay Generation Failed', description, variant: 'destructive' });
      updateSetting('aiGeneratedOverlayUri', null);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [currentScene, audioData, updateSetting, toast, settings.aiOverlayPrompt, settings.enableAiOverlay]);


 // Effect for initial overlay generation on load
 useEffect(
 () => {
    if (
      !settings.aiGeneratedOverlayUri &&
      currentScene &&
      !initialGenerationAttempted.current &&
      !isLoading
    ) {
 console.log( '[AiVisualOverlayMixer] Attempting initial AI overlay generation. Prompt:',
        settings.aiOverlayPrompt || DEFAULT_SETTINGS.aiOverlayPrompt
      );
      initialGenerationAttempted.current = true;
      handleGenerateOverlay(settings.aiOverlayPrompt || DEFAULT_SETTINGS.aiOverlayPrompt);
    }
  // Dependencies: Only run once when currentScene is available and other conditions are met.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 ,
 [currentScene, settings.aiGeneratedOverlayUri, isLoading] ); // Dependencies as intended for initial run

  // Periodic regeneration
  useEffect(() => {
    if (settings.enableAiOverlay && settings.enablePeriodicAiOverlay) {
      if (periodicUpdateIntervalId.current) {
        clearInterval(periodicUpdateIntervalId.current);
      }
      periodicUpdateIntervalId.current = setInterval(() => {
 if (!isLoading && currentScene) { // Ensure scene context is available
          console.log(`[AiVisualOverlayMixer] Triggering periodic regeneration. Interval: ${settings.aiOverlayRegenerationInterval}s`);
          handleGenerateOverlay(settings.aiOverlayPrompt || DEFAULT_SETTINGS.aiOverlayPrompt);
        }
      }, settings.aiOverlayRegenerationInterval * 1000);
    } else {
      if (periodicUpdateIntervalId.current) {
        clearInterval(periodicUpdateIntervalId.current);
        periodicUpdateIntervalId.current = null;
      }
    }
    return () => {
      if (periodicUpdateIntervalId.current) {
        clearInterval(periodicUpdateIntervalId.current);
      }
 };
  },
    settings.enableAiOverlay,
    settings.enablePeriodicAiOverlay,
    settings.aiOverlayRegenerationInterval, // Included missing dependency
    settings.aiOverlayPrompt,
    isLoading,
    handleGenerateOverlay,
    currentScene // Added currentScene dependency

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
          tooltipContent={<p>Toggles the visibility of the AI-generated visual overlay on the main visualizer.</p> }
          switchProps={{ disabled: !settings.aiGeneratedOverlayUri && !isLoading }}
          switchAriaLabel="Toggle Enable AI Overlay"
        />

        <div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Label htmlFor="ai-overlay-prompt">Overlay Prompt</Label>
            </TooltipTrigger>
            <TooltipContent>
              <p>Describe the visual style or elements for the AI-generated overlay.</p >
              <ControlHint>e.g., "{DEFAULT_SETTINGS.aiOverlayPrompt}"</ControlHint>
            </TooltipContent>
          </Tooltip>
          <Input
            id="ai-overlay-prompt"
            value={localPrompt}
            onChange={(e) => setLocalPrompt(e.target.value)}
            placeholder={DEFAULT_SETTINGS.aiOverlayPrompt}
            disabled={isLoading}
            aria-label="AI Overlay Prompt"
          />
          <AiSuggestedPromptDisplay
            suggestedPrompt={settings.lastAISuggestedAssetPrompt}
            onUsePrompt={(prompt) => {
              setLocalPrompt(prompt); // Apply suggested prompt to local state
              // Optionally trigger generation immediately upon using suggested prompt 
              // handleGenerateOverlay(prompt); 
            }}
            isLoading={isLoading}
            icon={Wand2}
            labelText="Suggestion:"
            containerClassName="mt-1.5 p-1.5"
          />
        </div>

        <Button onClick={() => handleGenerateOverlay(localPrompt)} disabled={isLoading || !currentScene} className="w-full">
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Layers className="mr-2 h-4 w-4" />
          )}
          {isLoading ? 'Generating...' : 'Generate New Overlay'}
        </Button>
 {!currentScene && <ControlHint className="text-destructive text-center">Select a scene first to generate an overlay.</ControlHint> }

        {settings.aiGeneratedOverlayUri && (
          <div className="mt-2 space-y-1">
            <Label>Generated Overlay Preview:</Label>
            <Image
              src={settings.aiGeneratedOverlayUri}
              alt="AI Generated Overlay"
              width={100}
              height={100}
              className="rounded border object-cover border-border" // Added border for clarity 
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
                  <p>Controls the transparency of the AI-generated overlay.</p >
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
                  <p>Determines how the AI overlay mixes with the main visualizer scene.</p >
                </TooltipContent>
              </Tooltip>
              <Select
                value={settings.aiOverlayBlendMode}
                onValueChange={(val) => updateSetting('aiOverlayBlendMode', val as GlobalCompositeOperation)}
                disabled={isLoading || !settings.enableAiOverlay}
              >
                <SelectTrigger id="ai-overlay-blend-mode-select" aria-label={`Select AI Overlay Blend Mode, current value ${settings.aiOverlayBlendMode}`}>
                  <SelectValue placeholder="Select blend mode" />
                </SelectTrigger>
                <SelectContent>
                  {blendModesArray.map(mode => ( // Use the imported array
                    <SelectItem key={mode} value={mode}>{mode.charAt(0).toUpperCase() + mode.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <LabelledSwitchControl
              labelContent="Enable Periodic Regeneration"
              labelHtmlFor="enable-periodic-overlay-switch"
              switchId="enable-periodic-overlay-switch"
              checked={settings.enablePeriodicAiOverlay}
              onCheckedChange={(checked) => updateSetting('enablePeriodicAiOverlay', checked)}
              tooltipContent={<p>If enabled, the AI overlay will regenerate periodically using the current prompt and audio context.</p> }
              containerClassName="mt-3"
              switchAriaLabel="Toggle Periodic AI Overlay Regeneration"
              switchProps={{ disabled: isLoading || !settings.enableAiOverlay }}
            />
            {settings.enablePeriodicAiOverlay && settings.enableAiOverlay && (
              <div className="space-y-1 mt-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Label htmlFor="ai-overlay-regen-interval-slider">
                      Regeneration Interval ({settings.aiOverlayRegenerationInterval}s)
                    </Label>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>How often the AI overlay regenerates, in seconds.</p >
                  </TooltipContent>
                </Tooltip>
                <Slider
                  id="ai-overlay-regen-interval-slider"
                  min={15}
                  max={120}
                  step={5}
                  value={[settings.aiOverlayRegenerationInterval]}
                  onValueChange={([val]) => updateSetting('aiOverlayRegenerationInterval', val)}
                  disabled={isLoading || !settings.enablePeriodicAiOverlay || !settings.enableAiOverlay}
                  aria-label={`AI Overlay Regeneration Interval: ${settings.aiOverlayRegenerationInterval} seconds`}
                />
              </div>
            )}
          </>
        )}
      </div>
    </ControlPanelSection>
  );
}
