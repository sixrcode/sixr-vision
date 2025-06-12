
"use client";

import { Button } from '@/components/ui/button';
// WHY: Context hook is no longer needed.
// import { useSettings as useSettingsContextHook } from '@/providers/SettingsProvider';
// WHY: Import the Zustand store directly.
import { useSettingsStore } from '@/store/settingsStore';
import type { Settings } from '@/types'; 

import { ControlPanelSection } from './ControlPanelSection';
import { AlertTriangle, ZapOff, Database, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { ControlHint } from './ControlHint';
import { LabelledSwitchControl } from './common/LabelledSwitchControl';
import { cn } from '@/lib/utils';
import { addLogEntry, getAllLogEntries, clearLogEntries } from '@/services/rehearsalLogService';

type OtherControlsProps = {
  value: string; // For AccordionItem
};

export function OtherControls({ value }: OtherControlsProps) {
  // WHY: Feature flag logic is removed. Component now always uses Zustand.
  // const useZustand = process.env.NEXT_PUBLIC_USE_ZUSTAND === 'pilot';

  // WHY: Directly select settings from the Zustand store.
  const panicMode = useSettingsStore(state => state.panicMode);
  const logoBlackout = useSettingsStore(state => state.logoBlackout);
  const zustandUpdateSetting = useSettingsStore(state => state.updateSetting);

  // WHY: Remove fallback to context settings.
  // const updateSettingFromStore = useZustand ? useSettingsStore(state => state.updateSetting) : useSettingsContextHook().updateSetting;

  // WHY: Define a consistent handler function for updating settings using Zustand.
  const handleUpdateSetting = <K extends keyof Settings>(key: K, val: Settings[K]) => {
    zustandUpdateSetting(key, val);
  };

  const handlePanicModeToggle = async (checked: boolean) => {
    // WHY: Update 'panicMode' using the Zustand update function.
    handleUpdateSetting('panicMode', checked);
    try {
      await addLogEntry('panic_mode_toggled', { panicModeActive: checked });
    } catch (e) {
      console.warn("Failed to log panic mode toggle:", e);
    }
  };

  const handleLogoBlackoutToggle = (checked: boolean) => {
    // WHY: Update 'logoBlackout' using the Zustand update function.
    handleUpdateSetting('logoBlackout', checked);
  };

  const handleExportLog = async () => {
    try {
      const logEntries = await getAllLogEntries();
      if (logEntries.length === 0) {
        toast({
          title: "Rehearsal Log is Empty",
          description: "No events have been logged to IndexedDB yet.",
        });
        return;
      }
      const header = 'timestamp,event_type,details_json\\n';
      const rows = logEntries.map(entry =>
        `${new Date(entry.timestamp).toISOString()},${entry.event},"${JSON.stringify(entry.details).replace(/"/g, '""')}"`
      ).join('\\n');
      const csvString = header + rows;
      console.log("--- Rehearsal Log (from IndexedDB - CSV Format) ---");
      console.log(csvString);
      console.log("----------------------------------------------------");
      toast({
        title: "Export Log (Simulated)",
        description: `Fetched ${logEntries.length} entries from IndexedDB. CSV-formatted log printed to console. Actual CSV file download is a future feature.`
      });
    } catch (error) {
      console.error("Error exporting log:", error);
      toast({
        title: "Error Exporting Log",
        description: "Could not fetch log entries. See console for details.",
        variant: "destructive",
      });
    }
  };

  const handleClearLog = async () => {
    try {
      await clearLogEntries();
      toast({
        title: "Rehearsal Log Cleared",
        description: "All entries have been removed from IndexedDB.",
      });
    } catch (error) {
      console.error("Error clearing log:", error);
      toast({
        title: "Error Clearing Log",
        description: "Could not clear log entries. See console for details.",
        variant: "destructive",
      });
    }
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
        // WHY: Read 'panicMode' from Zustand store.
        checked={panicMode}
        onCheckedChange={handlePanicModeToggle}
        tooltipContent={<p>Immediately blacks out the main visualizer output. Useful for emergencies.</p>}
        switchProps={{
          className: cn(
            "data-[state=checked]:bg-destructive",
            // WHY: Read 'panicMode' from Zustand for conditional animation.
            panicMode && "animate-destructive-pulse"
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
        // WHY: Read 'logoBlackout' from Zustand store.
        checked={logoBlackout}
        onCheckedChange={handleLogoBlackoutToggle}
        tooltipContent={<p>Hides all logo and watermark elements from the visualizer.</p>}
        containerClassName="mt-3"
        switchAriaLabel="Toggle Logo Blackout"
      />

      <div className="mt-4 space-y-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="sm" className="w-full" onClick={handleExportLog}>
              <Database className="mr-2 h-4 w-4" /> Export Rehearsal Log
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Exports a log of events and settings changes during the session to the console (from IndexedDB).</p>
          </TooltipContent>
        </Tooltip>
        <ControlHint>Log entries are stored in IndexedDB. CSV printed to console.</ControlHint>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="sm" className="w-full text-destructive hover:text-destructive" onClick={handleClearLog}>
              <Trash2 className="mr-2 h-4 w-4" /> Clear Rehearsal Log
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-destructive">Permanently deletes all entries from the IndexedDB rehearsal log.</p>
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="mt-4">
        <h4 className="text-xs font-semibold text-muted-foreground">Future Features (Planned):</h4>
        <ul className="list-disc list-inside text-xs text-muted-foreground pl-2">
          <li>WebSocket / OSC API</li>
          <li>Art-Net Bridge</li>
          <li>Adaptive Watchdog (FPS Monitor)</li>
          <li>Photosensitive Flash Guard</li>
          <li>Real-time Frame-Time Heatmap</li>
          <li>Ctrl+Z Undo Functionality</li>
          <li>JSON Cue List Player</li>
        </ul>
      </div>
    </ControlPanelSection>
  );
}
