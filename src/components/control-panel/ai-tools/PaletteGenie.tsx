
"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { generateHarmoniousPalettes, type GenerateHarmoniousPalettesInput, type GenerateHarmoniousPalettesOutput } from '@/ai/flows/generate-harmonious-palettes';
import type { PaletteGenieColor } from '@/types';
import { ControlPanelSection } from '../ControlPanelSection';
import { Wand2 } from 'lucide-react';

type PaletteGenieProps = {
  value: string; // For AccordionItem
};

export function PaletteGenie({ value }: PaletteGenieProps) {
  const [baseHue, setBaseHue] = useState(180); // Default to a nice blue/cyan
  const [numColors, setNumColors] = useState(5);
  const [generatedPalette, setGeneratedPalette] = useState<PaletteGenieColor[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    setIsLoading(true);
    setGeneratedPalette([]);
    try {
      const input: GenerateHarmoniousPalettesInput = {
        baseColorHue: baseHue,
        numColors: numColors,
      };
      const result: GenerateHarmoniousPalettesOutput = await generateHarmoniousPalettes(input);
      setGeneratedPalette(result);
      toast({
        title: 'Palette Generated',
        description: `${result.length} harmonious colors created.`,
      });
    } catch (error) {
      console.error('Error generating palette:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate palette. See console for details.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ControlPanelSection title="AI: Palette Genie" value={value}>
      <div className="space-y-3">
        <Label htmlFor="base-hue-slider">Base Hue ({baseHue}°)</Label>
        <Slider
          id="base-hue-slider"
          min={0}
          max={360}
          step={1}
          value={[baseHue]}
          onValueChange={([val]) => setBaseHue(val)}
          disabled={isLoading}
        />
      </div>
      <div className="space-y-3">
        <Label htmlFor="num-colors-input">Number of Colors (2-10)</Label>
        <Input
          id="num-colors-input"
          type="number"
          min={2}
          max={10}
          value={numColors}
          onChange={(e) => setNumColors(Math.max(2, Math.min(10, parseInt(e.target.value, 10) || 2)))}
          disabled={isLoading}
        />
      </div>
      <Button onClick={handleSubmit} disabled={isLoading} className="w-full mt-2">
        <Wand2 className="mr-2 h-4 w-4" /> {isLoading ? 'Generating...' : 'Generate Palette'}
      </Button>

      {generatedPalette.length > 0 && (
        <div className="mt-4 space-y-2">
          <Label>Generated Palette:</Label>
          <div className="flex flex-wrap gap-2">
            {generatedPalette.map((color, index) => (
              <div
                key={index}
                className="w-8 h-8 rounded border border-[hsl(var(--border))]"
                style={{
                  backgroundColor: `hsl(${color.hue}, ${color.saturation}%, ${color.brightness}%)`,
                }}
                title={`HSB: ${color.hue}, ${color.saturation}, ${color.brightness}`}
              />
            ))}
          </div>
        </div>
      )}
    </ControlPanelSection>
  );
}
