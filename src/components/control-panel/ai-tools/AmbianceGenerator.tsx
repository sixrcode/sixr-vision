
"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { generateSceneAmbiance, type GenerateSceneAmbianceInput, type GenerateSceneAmbianceOutput } from '@/ai/flows/generate-scene-ambiance';
import { ControlPanelSection } from '../ControlPanelSection';
import { MessageSquareText, Loader2 } from 'lucide-react';
import { useAudioData } from '@/providers/AudioDataProvider';
import { useScene } from '@/providers/SceneProvider';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ControlHint } from '../ControlHint';

type AmbianceGeneratorProps = {
  value: string; // For AccordionItem
};

export function AmbianceGenerator({ value }: AmbianceGeneratorProps) {
  const [ambianceText, setAmbianceText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { audioData } = useAudioData();
  const { currentScene } = useScene();

  const handleSubmit = async () => {
    if (!currentScene) {
      toast({
        title: 'No Scene Active',
        description: 'Please select a scene first.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    setAmbianceText('');
    try {
      const serializableAudioData = {
        bassEnergy: audioData.bassEnergy,
        midEnergy: audioData.midEnergy,
        trebleEnergy: audioData.trebleEnergy,
        rms: audioData.rms,
        bpm: audioData.bpm,
        beat: audioData.beat,
      };

      const input: GenerateSceneAmbianceInput = {
        audioData: serializableAudioData,
        currentSceneId: currentScene.id,
        currentSceneName: currentScene.name,
      };
      const result: GenerateSceneAmbianceOutput = await generateSceneAmbiance(input);
      setAmbianceText(result.ambianceText);
      toast({
        title: 'Ambiance Text Generated',
 description: "AI has described the current vibe!", // Adjusted for single quote escaping
      });
    } catch (error) {
      console.error('Error generating ambiance text:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate ambiance text. See console for details.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ControlPanelSection title="AI: Ambiance Text" value={value}>
      <div className="space-y-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button onClick={handleSubmit} disabled={isLoading || !currentScene} className="w-full">
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <MessageSquareText className="mr-2 h-4 w-4" />
              )}
              {isLoading ? 'Generating Vibe...' : 'Describe Current Vibe'}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Let AI generate a short, evocative text describing the current scene and audio mood.</p>
            {!currentScene && <p className="text-destructive">Select a scene first.</p>}
          </TooltipContent>&#x20;
        </Tooltip>&#x20;
        
        {ambianceText && (
          <div className="mt-3 space-y-1">
            <Label htmlFor="ambiance-output">AI's Description:</Label>
            <Textarea
              id="ambiance-output"
              value={ambianceText}
              readOnly
              rows={3}
              className="bg-background text-foreground"
              placeholder="AI generated ambiance text will appear here..."
            />
          </div>
        )}
      </div>
      <ControlHint className="mt-2">
        Generates a poetic snippet reflecting the current audiovisual experience.
      </ControlHint>
    </ControlPanelSection>
  );
}
