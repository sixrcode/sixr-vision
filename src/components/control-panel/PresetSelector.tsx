
"use client";

import { useScene } from '@/providers/SceneProvider';
// WHY: Context hook is no longer needed for currentSceneId.
// import { useSettings as useSettingsContextHook } from '@/providers/SettingsProvider';
// WHY: Import the Zustand store directly for currentSceneId.
import { useSettingsStore } from '@/store/settingsStore';

import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { ControlPanelSection } from './ControlPanelSection';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { PresetCard } from './PresetCard';

type PresetSelectorProps = {
  value: string; // For AccordionItem
};

export function PresetSelector({ value }: PresetSelectorProps) {
  const { scenes, setCurrentSceneById } = useScene();

  // WHY: Feature flag logic is removed. Component now always uses Zustand for currentSceneId.
  // const useZustand = process.env.NEXT_PUBLIC_USE_ZUSTAND === 'pilot';

  // WHY: Directly select currentSceneId from the Zustand store.
  const currentSceneId = useSettingsStore(state => state.currentSceneId);
  // const currentSceneId = useZustand
  //   ? useSettingsStore(state => state.currentSceneId)
  //   : useSettingsContextHook().settings.currentSceneId;

  return (
    <ControlPanelSection title="Presets" value={value}>
      <ScrollArea className="w-full h-auto max-h-[300px]">
        <div className="grid grid-cols-3 gap-2 p-1">
          {scenes.map((scene) => (
            <Tooltip key={scene.id}>
              <TooltipTrigger asChild>
                <PresetCard
                  scene={scene}
                  // WHY: Use currentSceneId from Zustand for isActive check.
                  isActive={currentSceneId === scene.id}
                  onClick={() => setCurrentSceneById(scene.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      setCurrentSceneById(scene.id);
                    }
                  }}
                />
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-semibold">{scene.name}</p>
                {scene.dataAiHint && (
                  <p className="text-xs text-muted-foreground">{scene.dataAiHint}</p>
                )}
                {!scene.dataAiHint && (
                   <p className="text-xs text-muted-foreground">Tooltip for {scene.name}.</p>
                )}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
        <ScrollBar orientation="vertical" />
      </ScrollArea>
    </ControlPanelSection>
  );
}
