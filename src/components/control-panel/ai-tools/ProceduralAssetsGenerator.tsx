
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
import { ImageIcon, Cuboid } from 'lucide-react';

type ProceduralAssetsGeneratorProps = {
  value: string; // For AccordionItem
};

export function ProceduralAssetsGenerator({ value }: ProceduralAssetsGeneratorProps) {
  const [prompt, setPrompt] = useState('');
  const [generatedAssets, setGeneratedAssets] = useState<ProceduralAsset | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

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
        <Label htmlFor="asset-prompt-input">Prompt</Label>
        <Input
          id="asset-prompt-input"
          placeholder="e.g., 'glowing alien crystal'"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={isLoading}
        />
      </div>
      <Button onClick={handleSubmit} disabled={isLoading} className="w-full mt-2">
        {isLoading ? 'Generating...' : 'Generate Assets'}
      </Button>

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
               {/* Displaying mesh data URI as an image is a placeholder. True 3D rendering is complex. */}
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
