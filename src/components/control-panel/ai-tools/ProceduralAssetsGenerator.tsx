
"use client";

import { useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { generateAssets, type GenerateAssetsInput, type GenerateAssetsOutput } from '@/ai/flows/generate-assets-from-prompt';
import type { ProceduralAsset } from '@/types';
import { ControlPanelSection } from '../ControlPanelSection';
import { ImageIcon, Cuboid, Sparkles, Loader2 } from 'lucide-react';
import { useSettings } from '@/providers/SettingsProvider';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { ControlHint } from '../ControlHint';
import { AiSuggestedPromptDisplay } from '../common/AiSuggestedPromptDisplay';

type ProceduralAssetsGeneratorProps = {
  value: string; // For AccordionItem
};

export function ProceduralAssetsGenerator({ value }: ProceduralAssetsGeneratorProps) {
  const [prompt, setPrompt] = useState('');
  const [generatedAssets, setGeneratedAssets] = useState<ProceduralAsset | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { settings } = useSettings();

  const handleSubmit = async () => {
    if (!prompt.trim()) {
      toast({ title: 'Prompt required', description: 'Please enter a descriptive prompt.', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    setGeneratedAssets(null);
    try {
      const input: GenerateAssetsInput = { prompt };
      const result: GenerateAssetsOutput = await generateAssets(input);
      setGeneratedAssets(result);
      toast({
        title: 'Assets Generated',
        description: 'Texture and mesh preview created based on your prompt.',
      });
    } catch (error) {
      console.error('Error generating assets:', error);
      toast({
        title: 'Error Generating Assets',
        description: error instanceof Error ? error.message : 'Failed to generate assets. See console for details.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ControlPanelSection title="AI: Procedural Assets" value={value}>
      <div className="space-y-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <Label htmlFor="asset-prompt-input">Prompt</Label>
          </TooltipTrigger>
          <TooltipContent>
            <p>Describe the texture or mesh you want the AI to generate. e.g., &apos;glowing alien crystal&apos;, &apos;rusty metal plate&apos;.</p>
          </TooltipContent>
        </Tooltip>
        <Input
          id="asset-prompt-input"
          placeholder="e.g., 'glowing alien crystal'"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={isLoading}
        />
      </div>

      <AiSuggestedPromptDisplay
        suggestedPrompt={settings.lastAISuggestedAssetPrompt}
        onUsePrompt={setPrompt}
        isLoading={isLoading}
        // Uses default icon (Sparkles) and labelText ("AI suggestion:")
      />
      
      <Tooltip>
        <TooltipTrigger asChild>
          <Button onClick={handleSubmit} disabled={isLoading} className="w-full mt-2">
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {isLoading ? 'Generating Assets...' : 'Generate Assets'}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Generates a texture image and a mesh preview image based on your text prompt.</p>
        </TooltipContent>
      </Tooltip>

      {generatedAssets && (
        <div className="mt-4 space-y-3">
          {generatedAssets.textureDataUri && (
            <div>
              <Label className="flex items-center"><ImageIcon className="mr-2 h-4 w-4" />Generated Texture:</Label>
              <Image
                src={generatedAssets.textureDataUri}
                alt="Generated Texture"
                width={100}
                height={100}
                className="rounded border mt-1 object-cover"
                data-ai-hint="generated texture"
              />
            </div>
          )}
          {generatedAssets.meshDataUri && (
            <div>
              <Label className="flex items-center"><Cuboid className="mr-2 h-4 w-4" />Generated Mesh (Preview):</Label>
              <Image
                src={generatedAssets.meshDataUri}
                alt="Generated Mesh Preview"
                width={100}
                height={100}
                className="rounded border mt-1 object-cover"
                data-ai-hint="generated mesh"
              />
              <ControlHint>Note: Mesh preview is shown as an image. Actual 3D mesh data generation is a future feature.</ControlHint>
            </div>
          )}
        </div>
      )}
       <ControlHint className="mt-2">Style-Transfer Shader (Planned Feature)</ControlHint>
    </ControlPanelSection>
  );
}
