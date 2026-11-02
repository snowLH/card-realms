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

type StateListener = (state: MatchState) => void;
type EventsListener = (events: readonly MatchVisualEvent[]) => void;
type HighlightListener = (highlighted: HighlightedBoardLanes) => void;
type SelectionListener = (selected: SelectedBoardSlot) => void;
type TargetClickListener = (target: BoardPointerTarget) => void;

export class CardRealmsBridge {
  private currentState: MatchState | null = null;
  private highlighted: HighlightedBoardLanes = null;
  private selected: SelectedBoardSlot = null;

  private readonly stateListeners = new Set<StateListener>();
  private readonly eventsListeners = new Set<EventsListener>();
  private readonly highlightListeners = new Set<HighlightListener>();
  private readonly selectionListeners = new Set<SelectionListener>();
  private readonly targetClickListeners = new Set<TargetClickListener>();

  getState(): MatchState | null {
    return this.currentState;
  }

  getHighlightedLanes(): HighlightedBoardLanes {
    return this.highlighted;
  }

  getSelectedSlot(): SelectedBoardSlot {
    return this.selected;
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

  emitBoardTargetClick(target: BoardPointerTarget) {
    for (const listener of this.targetClickListeners) {
      listener(target);
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

  onBoardTargetClick(listener: TargetClickListener): () => void {
    this.targetClickListeners.add(listener);
    return () => {
      this.targetClickListeners.delete(listener);
    };
  }
}
