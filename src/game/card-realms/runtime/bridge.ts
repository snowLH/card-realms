import type {
  LaneIndex,
  MatchState,
  MatchVisualEvent,
  PlayerSide,
} from "../domain/types";
import type { BoardPointerTarget } from "./input";

export type HighlightedBoardLanes = {
  side: PlayerSide;
  lanes: readonly LaneIndex[];
} | null;

export type SelectedBoardSlot = {
  side: PlayerSide;
  lane: LaneIndex;
} | null;

export type PreviewBoardSlot = {
  side: PlayerSide;
  lane: LaneIndex;
  cardId?: string;
} | null;

type StateListener = (state: MatchState) => void;
type EventsListener = (events: readonly MatchVisualEvent[]) => void;
type HighlightListener = (highlighted: HighlightedBoardLanes) => void;
type SelectionListener = (selected: SelectedBoardSlot) => void;
type PreviewListener = (preview: PreviewBoardSlot) => void;
type TargetClickListener = (target: BoardPointerTarget) => void;
type PointerMoveListener = (x: number, y: number) => void;

export class CardRealmsBridge {
  private currentState: MatchState | null = null;
  private highlighted: HighlightedBoardLanes = null;
  private selected: SelectedBoardSlot = null;
  private preview: PreviewBoardSlot = null;

  private readonly stateListeners = new Set<StateListener>();
  private readonly eventsListeners = new Set<EventsListener>();
  private readonly highlightListeners = new Set<HighlightListener>();
  private readonly selectionListeners = new Set<SelectionListener>();
  private readonly previewListeners = new Set<PreviewListener>();
  private readonly targetClickListeners = new Set<TargetClickListener>();
  private readonly pointerMoveListeners = new Set<PointerMoveListener>();

  getState(): MatchState | null {
    return this.currentState;
  }

  getHighlightedLanes(): HighlightedBoardLanes {
    return this.highlighted;
  }

  getSelectedSlot(): SelectedBoardSlot {
    return this.selected;
  }

  getPreviewSlot(): PreviewBoardSlot {
    return this.preview;
  }

  setState(state: MatchState) {
    this.currentState = state;
    for (const listener of this.stateListeners) {
      listener(state);
    }
  }

  emitVisualEvents(events: readonly MatchVisualEvent[]) {
    if (events.length === 0) return;
    for (const listener of this.eventsListeners) {
      listener(events);
    }
  }

  setHighlightedLanes(highlighted: HighlightedBoardLanes) {
    this.highlighted = highlighted;
    for (const listener of this.highlightListeners) {
      listener(highlighted);
    }
  }

  setSelectedSlot(selected: SelectedBoardSlot) {
    this.selected = selected;
    for (const listener of this.selectionListeners) {
      listener(selected);
    }
  }

  setPreviewSlot(preview: PreviewBoardSlot) {
    this.preview = preview;
    for (const listener of this.previewListeners) {
      listener(preview);
    }
  }

  emitBoardTargetClick(target: BoardPointerTarget) {
    for (const listener of this.targetClickListeners) {
      listener(target);
    }
  }

  emitPointerMove(x: number, y: number) {
    for (const listener of this.pointerMoveListeners) {
      listener(x, y);
    }
  }

  onState(listener: StateListener): () => void {
    this.stateListeners.add(listener);
    if (this.currentState) listener(this.currentState);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  onVisualEvents(listener: EventsListener): () => void {
    this.eventsListeners.add(listener);
    return () => {
      this.eventsListeners.delete(listener);
    };
  }

  onHighlightedLanes(listener: HighlightListener): () => void {
    this.highlightListeners.add(listener);
    listener(this.highlighted);
    return () => {
      this.highlightListeners.delete(listener);
    };
  }

  onSelectedSlot(listener: SelectionListener): () => void {
    this.selectionListeners.add(listener);
    listener(this.selected);
    return () => {
      this.selectionListeners.delete(listener);
    };
  }

  onPreviewSlot(listener: PreviewListener): () => void {
    this.previewListeners.add(listener);
    listener(this.preview);
    return () => {
      this.previewListeners.delete(listener);
    };
  }

  onBoardTargetClick(listener: TargetClickListener): () => void {
    this.targetClickListeners.add(listener);
    return () => {
      this.targetClickListeners.delete(listener);
    };
  }

  onPointerMove(listener: PointerMoveListener): () => void {
    this.pointerMoveListeners.add(listener);
    return () => {
      this.pointerMoveListeners.delete(listener);
    };
  }
}
