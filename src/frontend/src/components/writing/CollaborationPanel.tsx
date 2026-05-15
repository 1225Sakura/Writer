import {
  PanelHeader,
  CollaborationStatus,
  RatioSliderSection,
  BattleStation,
  PlotTracker,
  IFLinesSection,
  CharacterStorylines,
  ChapterProgress,
} from './collaboration'

export function CollaborationPanel() {
  return (
    <div className="flex-1 overflow-y-auto relative scrollbar-ink">
      <div className="relative z-10 space-y-3 px-3 py-2 md:px-4 md:py-3">
        <PanelHeader />
        <CollaborationStatus />
        <RatioSliderSection collapsible />
        <BattleStation />
        <PlotTracker />
        <IFLinesSection />
        <CharacterStorylines />
        <ChapterProgress />
      </div>
    </div>
  )
}