
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAudioDataStore } from '@/store/audioDataStore'; // MODIFIED: Import Zustand store
import { useSceneStore } from '@/store/sceneStore'; // MODIFIED: Import Zustand store
import { useSettingsStore } from '@/store/settingsStore'; // MODIFIED: Import Zustand store
import { suggestSceneFromAudio, type SuggestSceneFromAudioInput, type SuggestSceneFromAudioOutput } from '@/ai/flows/suggest-scene-from-audio';
import { ControlPanelSection } from '../ControlPanelSection';
import { Brain, Loader2 } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { ControlHint } from '../ControlHint';
import { LabelledSwitchControl } from '../common/LabelledSwitchControl';
import type { Settings } from '@/types';


type AiPresetChooserProps = {
  value: string; // For AccordionItem
};

export function AiPresetChooser({ value }: AiPresetChooserProps) {
  // MODIFIED: Use Zustand stores
  const audioData = useAudioDataStore(state => ({
    bassEnergy: state.bassEnergy,
    midEnergy: state.midEnergy,
    trebleEnergy: state.trebleEnergy,
    bpm: state.bpm,
    rms: state.rms, // Added rms for initial load condition
  }));
  const { setCurrentSceneById, scenes } = useSceneStore(state => ({
    setCurrentSceneById: state.setCurrentSceneById,
    scenes: state.scenes,
  }));
  const updateSetting = useSettingsStore(state => state.updateSetting);

  const { toast } = useToast();

  const [suggestedSceneInfo, setSuggestedSceneInfo] = useState<SuggestSceneFromAudioOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [autoLoadEnabled, setAutoLoadEnabled] = useState(false);
  const initialLoadAttemptedRef = useRef(false);
  const periodicUpdateIntervalId = useRef<NodeJS.Timeout | null>(null);

  const handleUpdateSetting = <K extends keyof Settings>(key: K, val: Settings[K]) => {
    updateSetting(key, val);
  };

  const fetchSuggestion = useCallback(async (isAutoTrigger = false) => {
    if (isLoading && !isAutoTrigger) return;
    if (isLoading && isAutoTrigger && autoLoadEnabled) return;

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
      handleUpdateSetting('lastAISuggestedAssetPrompt', result.suggestedAssetPrompt);

      const sceneExists = scenes.find(s => s.id === result.sceneId);

      if (autoLoadEnabled && sceneExists) {
        setCurrentSceneById(result.sceneId); // Removed 'ai_auto_suggestion' source
        if (!isAutoTrigger) {
          toast({ title: 'AI Scene Loaded', description: `Switched to ${result.sceneId} based on audio analysis.` });
        }
      } else if (autoLoadEnabled && !sceneExists && !isAutoTrigger) {
         toast({ title: 'AI Suggestion Error', description: `AI suggested scene "${result.sceneId}", but it's not available.`, variant: 'destructive' });
      } else if (!isAutoTrigger && !sceneExists) {
        toast({ title: 'AI Suggestion Error', description: `AI suggested scene &quot;${result.sceneId}&quot;, but it's not available. Asset idea: &quot;${result.suggestedAssetPrompt}&quot;`, variant: 'destructive' });
      } else if (!isAutoTrigger) {
        toast({ title: 'AI Suggestion', description: `Suggested scene: ${result.sceneId}. Asset idea: &quot;${result.suggestedAssetPrompt}&quot;` });
      }

      if (isAutoTrigger && !initialLoadAttemptedRef.current) {
        initialLoadAttemptedRef.current = true;
      }

    } catch (error) {
      console.error('Error suggesting scene:', error);
      if (!isAutoTrigger || (isAutoTrigger && autoLoadEnabled)) {
        toast({
          title: 'Error Suggesting Scene',
          description: error instanceof Error ? error.message : 'Failed to get scene suggestion.',
          variant: 'destructive',
        });
      }
      if (isAutoTrigger && !initialLoadAttemptedRef.current) {
        initialLoadAttemptedRef.current = true;
      }
    } finally {
      setIsLoading(false);
    }
  }, [audioData, autoLoadEnabled, setCurrentSceneById, toast, scenes, handleUpdateSetting, isLoading]);


 useEffect(() => {
    let timerId: NodeJS.Timeout | undefined;
    if (!initialLoadAttemptedRef.current && autoLoadEnabled && audioData.rms > 0.01 && audioData.bpm > 0) {
      console.log("AiPresetChooser: Attempting initial AI scene suggestion.");
      timerId = setTimeout(() => {
        if (!initialLoadAttemptedRef.current) {
            fetchSuggestion(true);
        }
      }, 5000);
    }
    return () => {
        if(timerId) clearTimeout(timerId);
    }
  }, [audioData.rms, audioData.bpm, autoLoadEnabled, fetchSuggestion]);


  useEffect(() => {
    if (periodicUpdateIntervalId.current) {
      clearInterval(periodicUpdateIntervalId.current);
      periodicUpdateIntervalId.current = null;
    }
    if (autoLoadEnabled && initialLoadAttemptedRef.current) {
      periodicUpdateIntervalId.current = setInterval(() => {
        if (audioData.bpm > 0 && (audioData.bassEnergy > 0.1 || audioData.midEnergy > 0.1 || audioData.trebleEnergy > 0.1)) {
           fetchSuggestion(true);
        }
      }, 30000);
    }
    return () => {
      if (periodicUpdateIntervalId.current) {
        clearInterval(periodicUpdateIntervalId.current);
        periodicUpdateIntervalId.current = null;
      }
    };
  }, [audioData, autoLoadEnabled, fetchSuggestion, initialLoadAttemptedRef]);

  const handleLoadSuggested = () => {
    if (suggestedSceneInfo?.sceneId) {
      if (scenes.find(s => s.id === suggestedSceneInfo.sceneId)) {
        setCurrentSceneById(suggestedSceneInfo.sceneId); // Removed 'manual_ai_suggestion_load' source
        toast({ title: 'Scene Loaded', description: `Switched to ${suggestedSceneInfo.sceneId}.` });
      } else {
        toast({ title: 'Scene Not Found', description: `Suggested scene "${suggestedSceneInfo.sceneId}" is not available.`, variant: 'destructive' });
      }
    }
  };

  return (
    <ControlPanelSection title="AI: Preset Chooser" value={value}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button onClick={() => fetchSuggestion(false)} disabled={isLoading} className="w-full">
            {isLoading && !autoLoadEnabled ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Brain className="mr-2 h-4 w-4" />
            )}
            {isLoading && !autoLoadEnabled ? 'Analyzing Audio...' : 'Suggest Scene & Assets'}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Analyzes current audio to suggest a suitable scene and a prompt for procedural assets.</p>
        </TooltipContent>
      </Tooltip>
      {suggestedSceneInfo && (
        <div className="mt-3 p-2 border rounded-md bg-background">
          <p className="text-sm font-medium">Suggested Scene: <span className="text-primary">{suggestedSceneInfo.sceneId}</span></p>
          <ControlHint className="mt-1">{suggestedSceneInfo.reason}</ControlHint>
          {suggestedSceneInfo.suggestedAssetPrompt && (
            <ControlHint className="mt-1">Asset idea: <em className="text-primary/90">&quot;{suggestedSceneInfo.suggestedAssetPrompt}&quot;</em> (use in Procedural Assets)</ControlHint>
          )}
          {scenes.find(s => s.id === suggestedSceneInfo.sceneId) && !autoLoadEnabled && (
            <Button onClick={handleLoadSuggested} size="sm" className="mt-2 w-full" disabled={isLoading}>
              Load Suggested Scene
            </Button>
          )}
        </div>
      )}
      <LabelledSwitchControl
        labelContent="Enable Auto-Suggestions"
        labelHtmlFor="auto-load-switch"
        switchId="auto-load-switch"
        checked={autoLoadEnabled}
        onCheckedChange={setAutoLoadEnabled}
        tooltipContent={
          <p>If enabled, AI periodically analyzes audio and suggests/loads scenes. Initial suggestion on first valid audio.</p>
        }
        containerClassName="mt-3"
        switchAriaLabel="Toggle auto-load scene suggestions"
        switchProps={{ disabled: isLoading }}
      />
      <ControlHint className="mt-1">When active, AI will periodically suggest & load scenes (every 30s after initial).</ControlHint>
    </ControlPanelSection>
  );
}
