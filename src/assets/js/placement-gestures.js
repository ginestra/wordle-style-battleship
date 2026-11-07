const dragThreshold = 6;

export function draggedShipPosition(row, col, orientation, grabbedOffset) {
  return {
    row: row - (orientation === "v" ? grabbedOffset : 0),
    col: col - (orientation === "h" ? grabbedOffset : 0)
  };
}

export class PlacementGestures {
  constructor({ board, list, getShip, canStart, onStart, onPreview, onListPreview, onClearPreview, onBoardDrop, onListDrop, onEnd, documentRef = document }) {
    this.board = board;
    this.list = list;
    this.getShip = getShip;
    this.canStart = canStart;
    this.onStart = onStart;
    this.onPreview = onPreview;
    this.onListPreview = onListPreview;
    this.onClearPreview = onClearPreview;
    this.onBoardDrop = onBoardDrop;
    this.onListDrop = onListDrop;
    this.onEnd = onEnd;
    this.document = documentRef;
    this.pointer = null;
    this.suppressClick = false;
    this.suppressClickTimer = null;
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerEnd = this.handlePointerEnd.bind(this);
    board.addEventListener("pointerdown", this.handlePointerDown);
    list.addEventListener("pointerdown", this.handlePointerDown);
  }

  consumeClick() {
    if (!this.suppressClick) return false;
    this.document.defaultView?.clearTimeout(this.suppressClickTimer);
    this.suppressClick = false;
    this.suppressClickTimer = null;
    return true;
  }

  handlePointerDown(event) {
    if (this.pointer || !this.canStart() || (event.pointerType === "mouse" && event.button !== 0)) return;
    const handle = event.target.closest("[data-drag-ship]");
    if (!handle || (!this.board.contains(handle) && !this.list.contains(handle))) return;
    const shipIndex = Number(handle.dataset.dragShip);
    const ship = this.getShip(shipIndex);
    if (!ship) return;
    const fromFleetList = this.list.contains(handle);

    this.pointer = {
      id: event.pointerId,
      shipIndex,
      offset: fromFleetList ? 0 : Number(handle.dataset.shipOffset || 0),
      startX: event.clientX,
      startY: event.clientY,
      dragging: false,
      target: null,
      ghost: null
    };
    this.document.addEventListener("pointermove", this.handlePointerMove, { passive: false });
    this.document.addEventListener("pointerup", this.handlePointerEnd);
    this.document.addEventListener("pointercancel", this.handlePointerEnd);
  }

  handlePointerMove(event) {
    const drag = this.pointer;
    if (!drag || event.pointerId !== drag.id) return;
    if (!drag.dragging && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < dragThreshold) return;
    event.preventDefault();

    if (!drag.dragging) {
      drag.dragging = true;
      drag.ghost = this.createGhost(this.getShip(drag.shipIndex));
      this.onStart(drag.shipIndex);
    }
    drag.ghost.style.left = `${event.clientX}px`;
    drag.ghost.style.top = `${event.clientY}px`;

    const beneath = this.document.elementFromPoint(event.clientX, event.clientY);
    const cell = beneath?.closest("[data-placement-board] .board-cell");
    this.onClearPreview();
    if (cell && this.board.contains(cell)) {
      drag.target = { type: "board", row: Number(cell.dataset.row), col: Number(cell.dataset.col) };
      this.onPreview(drag.shipIndex, drag.target.row, drag.target.col, drag.offset);
    } else if (beneath && this.list.contains(beneath)) {
      drag.target = { type: "list" };
      this.onListPreview();
    } else {
      drag.target = null;
    }
  }

  handlePointerEnd(event) {
    const drag = this.pointer;
    if (!drag || event.pointerId !== drag.id) return;
    const target = drag.target;
    const wasDragging = drag.dragging;
    const cancelled = event.type === "pointercancel";
    const { shipIndex, offset } = drag;
    this.cleanup();
    if (!wasDragging || cancelled) return;

    this.suppressClick = true;
    this.suppressClickTimer = this.document.defaultView?.setTimeout(() => {
      this.suppressClick = false;
      this.suppressClickTimer = null;
    }, 500);
    if (target?.type === "board") this.onBoardDrop(shipIndex, target.row, target.col, offset);
    else if (target?.type === "list") this.onListDrop(shipIndex);
  }

  cleanup() {
    const drag = this.pointer;
    this.document.removeEventListener("pointermove", this.handlePointerMove);
    this.document.removeEventListener("pointerup", this.handlePointerEnd);
    this.document.removeEventListener("pointercancel", this.handlePointerEnd);
    this.onClearPreview();
    if (drag?.dragging) this.onEnd(drag.shipIndex);
    drag?.ghost?.remove();
    this.pointer = null;
  }

  createGhost(ship) {
    const ghost = this.document.createElement("div");
    ghost.className = `ship-drag-ghost is-${ship.orientation || "h"}`;
    ghost.style.setProperty("--ship-length", ship.length);
    for (let index = 0; index < ship.length; index += 1) ghost.append(this.document.createElement("i"));
    this.document.body.append(ghost);
    return ghost;
  }
}
