
"use client";

import { Button } from '@/components/ui/button';
import { useSettings } from '@/providers/SettingsProvider';
import { ControlPanelSection } from './ControlPanelSection';
import { AlertTriangle, ZapOff, FileJson, Database } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { ControlHint } from './ControlHint';
import { LabelledSwitchControl } from './common/LabelledSwitchControl';
import { cn } from '@/lib/utils';
import type { RehearsalLogEntry } from '@/types'; // Import the type

type OtherControlsProps = {
  value: string; // For AccordionItem
};

export function OtherControls({ value }: OtherControlsProps) {
  const { settings, updateSetting } = useSettings();

  const handleExportLog = () => {
    // --- PRIVACY & SECURITY NOTE for future full implementation ---
    // If this feature is built out to use IndexedDB:
    // 1. Clearly inform the user what data is being logged locally.
    // 2. Obtain consent if logging potentially sensitive inputs (e.g., detailed AI prompts beyond operational parameters).
    // 3. Avoid logging raw audio/video data or PII unless absolutely necessary and secured.
    // 4. Consider options for users to clear their local rehearsal log.
    // 5. The current simulation logs operational data like scene changes and setting values.
    // --- End of Privacy Note ---

    // Simulate log entries
    const sampleLogEntries: RehearsalLogEntry[] = [
      {
        timestamp: Date.now() - 50000,
        event: 'scene_change',
        details: { sceneId: 'radial_burst', reason: 'manual' },
      },
      {
        timestamp: Date.now() - 45000,
        event: 'setting_update',
        details: { settingKey: 'gamma', oldValue: 1.0, newValue: 1.2 },
      },
      {
        timestamp: Date.now() - 30000,
        event: 'ai_overlay_generated',
        details: { prompt: settings.aiOverlayPrompt || "default prompt" },
      },
      {
        timestamp: Date.now() - 10000,
        event: 'scene_change',
        details: { sceneId: settings.currentSceneId, reason: 'ai_suggestion' },
      },
       {
        timestamp: Date.now(),
        event: 'panic_mode_toggled',
        details: { panicModeActive: settings.panicMode },
      },
    ];

    // Convert to CSV string
    const header = 'timestamp,event_type,details_json\n';
    const rows = sampleLogEntries.map(entry => 
      `${new Date(entry.timestamp).toISOString()},${entry.event},"${JSON.stringify(entry.details).replace(/"/g, '""')}"`
    ).join('\n');
    const csvString = header + rows;

    console.log("--- Sample Rehearsal Log (CSV Format) ---");
    console.log(csvString);
    console.log("----------------------------------------");

    toast({ 
      title: "Export Log (Simulated)", 
      description: "A sample CSV-formatted log has been printed to the browser console. Full IndexedDB logging & CSV export is a future feature." 
    });
  };
  
  const handleLoadCueList = () => {
    console.log("Load JSON cue-list (placeholder)");
    toast({ title: "Load Cue List", description: "JSON cue-list player is a placeholder." });
  };

  return (
    <ControlPanelSection title="System & Safety" value={value}>
      <LabelledSwitchControl
        labelContent={
          <span className="flex items-center text-destructive">
            <AlertTriangle className="mr-2 h-4 w-4" /> Panic Mode (Blackout)
          </span>
        }
        labelHtmlFor="panic-mode-switch"
        switchId="panic-mode-switch"
        checked={settings.panicMode}
        onCheckedChange={(checked) => updateSetting('panicMode', checked)}
        tooltipContent={<p>Immediately blacks out the main visualizer output. Useful for emergencies.</p>}
        switchProps={{ 
          className: cn(
            "data-[state=checked]:bg-destructive", // Ensure this class is applied for red background
            settings.panicMode && "animate-destructive-pulse"
          ) 
        }}
        switchAriaLabel="Toggle Panic Mode"
      />
      <LabelledSwitchControl
        labelContent={
          <span className="flex items-center">
            <ZapOff className="mr-2 h-4 w-4" /> Logo Blackout
          </span>
        }
        labelHtmlFor="logo-blackout-switch"
        switchId="logo-blackout-switch"
        checked={settings.logoBlackout}
        onCheckedChange={(checked) => updateSetting('logoBlackout', checked)}
        tooltipContent={<p>Hides all logo and watermark elements from the visualizer.</p>}
        containerClassName="mt-3"
        switchAriaLabel="Toggle Logo Blackout"
      />
      
      <div className="mt-4 space-y-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="sm" className="w-full" onClick={handleLoadCueList}>
              <FileJson className="mr-2 h-4 w-4" /> Load Cue List (JSON)
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Loads a predefined sequence of scene changes and setting adjustments. (Placeholder)</p>
          </TooltipContent>
        </Tooltip>
        <ControlHint>Cue list player is a placeholder.</ControlHint>
        
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="sm" className="w-full" onClick={handleExportLog}>
              <Database className="mr-2 h-4 w-4" /> Export Rehearsal Log (CSV)
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Exports a log of events and settings changes during the session. (Simulated: logs sample to console)</p>
          </TooltipContent>
        </Tooltip>
        <ControlHint>IndexedDB logging & export are future features. Sample log printed to console.</ControlHint>
      </div>

      <div className="mt-4">
        <h4 className="text-xs font-semibold text-muted-foreground">Placeholders for Advanced Features:</h4>
        <ul className="list-disc list-inside text-xs text-muted-foreground pl-2">
          <li>WebSocket / OSC API</li>
          <li>Art-Net Bridge</li>
          <li>Adaptive Watchdog (FPS Monitor)</li>
          <li>Photosensitive Flash Guard</li>
          <li>Real-time Frame-Time Heatmap</li>
          <li>Ctrl+Z Undo</li>
        </ul>
      </div>
    </ControlPanelSection>
  );
}
