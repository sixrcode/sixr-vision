
"use client";

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAudioData } from '@/providers/AudioDataProvider';
import { useScene } from '@/providers/SceneProvider';
import { useSettings } from '@/providers/SettingsProvider';
import { suggestSceneFromAudio, type SuggestSceneFromAudioInput, type SuggestSceneFromAudioOutput } from '@/ai/flows/suggest-scene-from-audio';
import { ControlPanelSection } from '../ControlPanelSection';
import { Brain } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

type AiPresetChooserProps = {
  value: string; // For AccordionItem
};

export function AiPresetChooser({ value }: AiPresetChooserProps) {
  const { audioData } = useAudioData();
  const { setCurrentSceneById, scenes } = useScene();
  const { updateSetting } = useSettings();
  const [suggestedSceneInfo, setSuggestedSceneInfo] = useState<SuggestSceneFromAudioOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [autoLoad, setAutoLoad] = useState(true); // Changed default to true

  const fetchSuggestion = useCallback(async (isAutoTrigger = false) => {
    setIsLoading(true);
    try {
      const input: SuggestSceneFromAudioInput = {
        bassEnergy: audioData.bassEnergy,
        midEnergy: audioData.midEnergy,
        trebleEnergy: audioData.trebleEnergy,
        bpm: audioData.bpm,
      };
      const result = await suggestSceneFromAudio(input);
      setSuggestedSceneInfo(result);
      updateSetting('lastAISuggestedAssetPrompt', result.suggestedAssetPrompt);

      if (autoLoad && scenes.find(s => s.id === result.sceneId)) {
        setCurrentSceneById(result.sceneId);
        if (!isAutoTrigger) { 
          toast({ title: 'AI Scene Loaded', description: `Switched to ${result.sceneId} based on audio analysis.` });
        }
      } else if (autoLoad && !isAutoTrigger) {
         toast({ title: 'AI Suggestion', description: `Suggested ${result.sceneId}, but it's not available or auto-load conditions not met.` });
      } else if (!isAutoTrigger) {
        toast({ title: 'AI Suggestion', description: `Suggested scene: ${result.sceneId}. Asset idea: "${result.suggestedAssetPrompt}"` });
      }
    } catch (error) {
      console.error('Error suggesting scene:', error);
      if (!isAutoTrigger || (isAutoTrigger && autoLoad)) { 
        toast({
          title: 'Error',
          description: 'Failed to get scene suggestion.',
          variant: 'destructive',
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [audioData, autoLoad, setCurrentSceneById, toast, scenes, updateSetting]);

  useEffect(() => {
    let timer: NodeJS.Timeout | undefined;
    if (autoLoad) {
      // Initial fetch shortly after component mounts if conditions are met
      if (audioData.bpm > 0 && (audioData.bassEnergy > 0.1 || audioData.midEnergy > 0.1 || audioData.trebleEnergy > 0.1)) {
        fetchSuggestion(true);
      }
      // Then set up periodic checks
      timer = setInterval(() => { // Changed from setTimeout to setInterval for periodic checks
        if (audioData.bpm > 0 && (audioData.bassEnergy > 0.1 || audioData.midEnergy > 0.1 || audioData.trebleEnergy > 0.1)) {
           fetchSuggestion(true); 
        }
      }, 10000); // Check every 10 seconds for example
    }
    return () => {
      if (timer) clearInterval(timer); // Use clearInterval for setInterval
    };
  }, [audioData, autoLoad, fetchSuggestion]);

  const handleLoadSuggested = () => {
    if (suggestedSceneInfo?.sceneId && scenes.find(s => s.id === suggestedSceneInfo.sceneId)) {
      setCurrentSceneById(suggestedSceneInfo.sceneId);
      toast({ title: 'Scene Loaded', description: `Switched to ${suggestedSceneInfo.sceneId}.` });
    } else if (suggestedSceneInfo?.sceneId) {
       toast({ title: 'Scene Not Found', description: `Scene ${suggestedSceneInfo.sceneId} is not available.`, variant: 'destructive' });
    }
  };

  return (
    <ControlPanelSection title="AI: Preset Chooser" value={value}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button onClick={() => fetchSuggestion(false)} disabled={isLoading} className="w-full">
            <Brain className="mr-2 h-4 w-4" /> {isLoading ? 'Analyzing...' : 'Suggest Scene & Assets'}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Analyzes current audio to suggest a suitable scene and a prompt for procedural assets.</p>
        </TooltipContent>
      </Tooltip>
      {suggestedSceneInfo && (
        <div className="mt-3 p-2 border border-[hsl(var(--border))] rounded-md bg-[hsl(var(--background))]">
          <p className="text-sm font-medium">Suggested Scene: <span className="text-primary">{suggestedSceneInfo.sceneId}</span></p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">{suggestedSceneInfo.reason}</p>
          {suggestedSceneInfo.suggestedAssetPrompt && (
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">Asset idea: <em className="text-primary/90">"{suggestedSceneInfo.suggestedAssetPrompt}"</em> (use in Procedural Assets)</p>
          )}
          {scenes.find(s => s.id === suggestedSceneInfo.sceneId) && !autoLoad && (
            <Button onClick={handleLoadSuggested} size="sm" className="mt-2 w-full">
              Load Suggested Scene
            </Button>
          )}
        </div>
      )}
      <div className="flex items-center justify-between mt-3 space-x-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Label htmlFor="auto-load-switch" className="flex-1 min-w-0 text-sm">Auto-load suggestion</Label>
          </TooltipTrigger>
          <TooltipContent>
            <p>If enabled, the AI will periodically analyze audio and automatically load the suggested scene.</p>
          </TooltipContent>
        </Tooltip>
        <Switch id="auto-load-switch" checked={autoLoad} onCheckedChange={setAutoLoad} aria-label="Toggle auto-load scene suggestions" />
      </div>
      <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">When active, AI will periodically suggest & load scenes.</p>
    </ControlPanelSection>
  );
}
