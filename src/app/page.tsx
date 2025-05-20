"use client"; // Top-level page can be client component for this type of app

import { AppContainer } from '@/components/layout/AppContainer';
import { VisualizerView } from '@/components/visualizer/VisualizerView';
import { ControlPanelView } from '@/components/control-panel/ControlPanelView';

export default function Home() {
  return (
    <AppContainer
      visualizer={<VisualizerView />}
      controlPanel={<ControlPanelView />}
    />
  );
}
