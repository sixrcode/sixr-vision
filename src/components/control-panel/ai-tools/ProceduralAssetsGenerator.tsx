
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
        description: 'Texture and mesh created based on your prompt.',
      });
    } catch (error) {
      console.error('Error generating assets:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate assets. See console for details.',
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
            <p>Describe the texture or mesh you want the AI to generate. e.g., 'glowing alien crystal', 'rusty metal plate'.</p>
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

      {settings.lastAISuggestedAssetPrompt && (
        <div className="mt-2 p-2 border border-dashed border-[hsl(var(--border))] rounded-md bg-[hsl(var(--background))]">
          <div className="flex items-center justify-between">
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              <Sparkles className="inline h-3 w-3 mr-1 text-primary/80" />
              AI suggestion: <em className="text-primary/90">"{settings.lastAISuggestedAssetPrompt}"</em>
            </p>
            <Button
              size="xs"
              variant="outline"
              onClick={() => setPrompt(settings.lastAISuggestedAssetPrompt!)}
              className="px-2 py-1 h-auto text-xs"
              disabled={isLoading}
            >
              Use
            </Button>
          </div>
        </div>
      )}
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
                className="rounded border border-[hsl(var(--border))] mt-1 object-cover"
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
                className="rounded border border-[hsl(var(--border))] mt-1 object-cover"
                data-ai-hint="generated mesh"
              />
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Note: Mesh preview is shown as an image. Actual mesh data available.</p>
            </div>
          )}
        </div>
      )}
      <p className="text-xs text-[hsl(var(--muted-foreground))] mt-2">Style-Transfer Shader: Placeholder</p>
    </ControlPanelSection>
  );
}
