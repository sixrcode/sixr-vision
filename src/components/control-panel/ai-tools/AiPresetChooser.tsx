
"use client";

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAudioData } from '@/providers/AudioDataProvider';
import { useScene } from '@/providers/SceneProvider';
import { useSettings } from '@/providers/SettingsProvider';
import { suggestSceneFromAudio, type SuggestSceneFromAudioInput, type SuggestSceneFromAudioOutput } from '@/ai/flows/suggest-scene-from-audio';
import { ControlPanelSection } from '../ControlPanelSection';
import { Brain } from 'lucide-react';

type AiPresetChooserProps = {
  value: string; // For AccordionItem
};

export function AiPresetChooser({ value }: AiPresetChooserProps) {
  const { audioData } = useAudioData();
  const { setCurrentSceneById, scenes } = useScene();
  const { updateSetting } = useSettings(); // Get updateSetting from useSettings
  const [suggestedSceneInfo, setSuggestedSceneInfo] = useState<SuggestSceneFromAudioOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [autoLoad, setAutoLoad] = useState(false); // Placeholder for auto-load toggle

  const fetchSuggestion = useCallback(async () => {
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
      updateSetting('lastAISuggestedAssetPrompt', result.suggestedAssetPrompt); // Update setting

      if (autoLoad && scenes.find(s => s.id === result.sceneId)) {
        setCurrentSceneById(result.sceneId);
        toast({ title: 'AI Scene Loaded', description: `Switched to ${result.sceneId} based on audio.` });
      } else if (autoLoad) {
         toast({ title: 'AI Suggestion', description: `Suggested ${result.sceneId}, but it's not available.` });
      }
    } catch (error) {
      console.error('Error suggesting scene:', error);
      toast({
        title: 'Error',
        description: 'Failed to get scene suggestion.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [audioData, autoLoad, setCurrentSceneById, toast, scenes, updateSetting]);

  // Debounce fetching suggestions or fetch on significant audio changes
  useEffect(() => {
    // This is a simple trigger, can be made more sophisticated (e.g., on beat, or energy threshold change)
    const timer = setTimeout(() => {
       // Only fetch if BPM is somewhat stable and there's some energy
      if (audioData.bpm > 0 && (audioData.bassEnergy > 0.1 || audioData.midEnergy > 0.1 || audioData.trebleEnergy > 0.1)) {
         // fetchSuggestion(); // Uncomment to enable automatic suggestions, can be frequent
      }
    }, 2000); // Suggest every 2 seconds if conditions met
    return () => clearTimeout(timer);
  }, [audioData, fetchSuggestion]);

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
      <Button onClick={fetchSuggestion} disabled={isLoading} className="w-full">
        <Brain className="mr-2 h-4 w-4" /> {isLoading ? 'Analyzing...' : 'Suggest Scene & Assets'}
      </Button>
      {suggestedSceneInfo && (
        <div className="mt-3 p-2 border border-[hsl(var(--border))] rounded-md bg-[hsl(var(--background))]">
          <p className="text-sm font-medium">Suggested Scene: <span className="text-primary">{suggestedSceneInfo.sceneId}</span></p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">{suggestedSceneInfo.reason}</p>
          {suggestedSceneInfo.suggestedAssetPrompt && (
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">Asset idea: <em className="text-primary/90">"{suggestedSceneInfo.suggestedAssetPrompt}"</em> (use in Procedural Assets)</p>
          )}
          {scenes.find(s => s.id === suggestedSceneInfo.sceneId) && (
            <Button onClick={handleLoadSuggested} size="sm" className="mt-2 w-full">
              Load Suggested Scene
            </Button>
          )}
        </div>
      )}
       {/* Placeholder for auto-load toggle */}
      {/* <div className="flex items-center justify-between mt-2">
        <Label htmlFor="auto-load-switch">Auto-load suggestion</Label>
        <Switch id="auto-load-switch" checked={autoLoad} onCheckedChange={setAutoLoad} />
      </div> */}
      <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">Auto-load is a placeholder feature.</p>
    </ControlPanelSection>
  );
}
