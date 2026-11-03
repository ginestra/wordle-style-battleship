import { copyText, showToast } from "./ui.js";
import { renderAttackProgress } from "./fleet-progress.js";
import { GAME_MODES, canPlaceShip, cellAt, cellsForShip, coordinate, createBoard, randomFleet, syncBoardTabStops, validateFleet } from "./game-rules.js";
import { clearHostInvitation, loadHostInvitation, parseInvitationHash, saveHostInvitation } from "./invitation.js";
import { MultiplayerApi } from "./multiplayer-api.js";
import { multiplayerResult } from "./multiplayer-result.js";
import { shouldRefreshGame } from "./realtime-state.js";
import { RefreshQueue } from "./refresh-queue.js";
import { opponentMoveTime } from "./relative-time.js";
import { hasMyShotAt, shotTargetsMe } from "./shot-state.js";
import { ensureAnonymousSession, getSupabase } from "./supabase-client.js";
import { VisibilityPause } from "./visibility-pause.js";

const root = document.querySelector("[data-multiplayer-root]");

class MultiplayerController {
  constructor(element) {
    this.root = element;
    this.api = new MultiplayerApi();
    this.mode = "quick";
    this.gameId = null;
    this.inviteUrl = null;
    this.userId = null;
    this.state = null;
    this.channel = null;
    this.hasSubscribed = false;
    this.refreshQueue = new RefreshQueue(() => this.fetchAndRender());
    this.fleet = [];
    this.selectedShip = 0;
    this.orientation = "h";
    this.isLockingFleet = false;
    this.wasMyTurn = false;
    this.resultDialogDismissed = false;
    this.placementCells = [];
    this.targetCells = [];
    this.ownCells = [];
    this.opponentMoveTimer = window.setInterval(() => this.renderOpponentMoveTime(), 60000);
    this.visibilityPause = new VisibilityPause({
      onPause: () => this.pauseRealtimeForBackground(),
      onResume: () => this.resumeRealtimeAfterBackground(),
      onError: (error) => this.fail(error)
    });
  }

  async start() {
    this.bindControls();
    try {
      const invitation = parseInvitationHash(location.hash);
      if (!invitation.gameId) {
        this.setConnection("online", "Ready");
        return;
      }
      await this.ensurePlayerSession();
      this.gameId = invitation.gameId;
      if (invitation.joinToken) await this.api.joinGame(this.gameId, invitation.joinToken);
      const playerParameter = invitation.joinToken || invitation.player === "guest" ? "&player=guest" : "";
      window.history.replaceState(null, "", `${location.pathname}#game=${encodeURIComponent(this.gameId)}${playerParameter}`);
      await this.subscribe();
      await this.refreshQueue.runNow();
    } catch (error) {
      this.fail(error);
    }
  }

  async ensurePlayerSession() {
    if (this.userId) return;
    const session = await ensureAnonymousSession();
    this.userId = session.user.id;
    this.setConnection("online", "Connected");
  }

  bindControls() {
    const nameInput = this.root.querySelector("[data-host-name]");
    nameInput.addEventListener("input", () => nameInput.setCustomValidity(""));
    this.root.querySelectorAll("[data-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        this.mode = button.dataset.mode;
        this.root.querySelectorAll("[data-mode]").forEach((option) => {
          const selected = option === button;
          option.classList.toggle("is-selected", selected);
          option.setAttribute("aria-pressed", selected);
        });
      });
    });
    this.root.querySelector("[data-create-game]").addEventListener("click", () => this.createGame());
    this.root.querySelectorAll("[data-copy-invitation]").forEach((button) => button.addEventListener("click", () => {
      if (this.inviteUrl) copyText(this.inviteUrl, "Invitation copied");
    }));
    this.root.querySelector("[data-rotate]").addEventListener("click", () => { this.orientation = this.orientation === "h" ? "v" : "h"; showToast(`Ships place ${this.orientation === "h" ? "horizontally" : "vertically"}`); });
    this.root.querySelector("[data-randomize]").addEventListener("click", () => { this.fleet = randomFleet(this.state.game.mode); this.selectedShip = -1; this.renderPlacement(); });
    this.root.querySelector("[data-clear-fleet]").addEventListener("click", () => { this.resetFleet(); this.renderPlacement(); });
    this.root.querySelector("[data-ready]").addEventListener("click", () => this.lockFleet());
    this.root.querySelector("[data-resign-game]").addEventListener("click", () => this.showResignDialog());
    this.root.querySelector("[data-cancel-resign]").addEventListener("click", () => this.closeResignDialog());
    this.root.querySelector("[data-confirm-resign]").addEventListener("click", () => this.resignGame());
    this.root.querySelector("[data-dismiss-result]").addEventListener("click", () => this.dismissResultDialog());
    this.root.querySelector("[data-result-dialog]").addEventListener("cancel", () => { this.resultDialogDismissed = true; });
    document.addEventListener("visibilitychange", () => this.handleVisibilityChange());
  }

  async createGame() {
    const button = this.root.querySelector("[data-create-game]");
    const nameInput = this.root.querySelector("[data-host-name]");
    const hostName = nameInput.value.trim().replace(/\s+/g, " ");
    if (!hostName) {
      nameInput.focus();
      nameInput.setCustomValidity("Enter your name to create an invitation.");
      nameInput.reportValidity();
      return;
    }
    nameInput.setCustomValidity("");
    button.disabled = true;
    button.textContent = "Creating…";
    try {
      await this.ensurePlayerSession();
      const created = await this.api.createGame(this.mode, hostName);
      this.gameId = created.game_id;
      const hostUrl = `${location.pathname}#game=${encodeURIComponent(this.gameId)}`;
      const inviteUrl = `${location.origin}${location.pathname}#game=${encodeURIComponent(this.gameId)}&join=${encodeURIComponent(created.join_token)}`;
      const provisionalExpiry = new Date(Date.now() + 86400000).toISOString();
      this.inviteUrl = inviteUrl;
      saveHostInvitation(localStorage, { gameId: this.gameId, url: inviteUrl, expiresAt: provisionalExpiry });
      window.history.replaceState(null, "", hostUrl);
      this.root.querySelector("[data-room-code]").textContent = created.room_code;
      this.root.querySelector("[data-share-url]").value = inviteUrl;
      await this.subscribe();
      await this.refreshQueue.runNow();
    } catch (error) {
      button.disabled = false;
      button.textContent = "Create private match";
      this.fail(error);
    }
  }

  async subscribe() {
    if (this.channel) await getSupabase().removeChannel(this.channel);
    this.hasSubscribed = false;
    this.channel = getSupabase()
      .channel(`game:${this.gameId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "games", filter: `id=eq.${this.gameId}` }, (payload) => {
        if (shouldRefreshGame(this.state?.game?.updated_at, payload)) this.refreshQueue.schedule();
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          this.setConnection("online", "Live");
          if (this.hasSubscribed) void this.refreshQueue.runNow();
          this.hasSubscribed = true;
          this.handleVisibilityChange();
        }
        if (["CHANNEL_ERROR", "TIMED_OUT"].includes(status)) this.setConnection("error", "Reconnecting");
      });
  }

  async fetchAndRender() {
    try {
      const state = await this.api.getState(this.gameId);
      this.state = state;
      if (state.own_fleet?.length && !this.fleet.length) this.fleet = state.own_fleet;
      this.render();
    } catch (error) {
      this.fail(error);
    }
  }

  render() {
    const { game, players } = this.state;
    const isHost = players.some((player) => player.user_id === this.userId && player.seat === 1);
    this.syncInvitation(game, isHost);
    this.root.querySelector("[data-game-title]").textContent = isHost
      ? `${game.host_name} · Room ${game.room_code}`
      : `${game.host_name} invited you to Room ${game.room_code}`;
    if (players.length < 2) {
      this.showView("waiting");
      this.setStatus("Room ready.", "Share the private invitation with one other player.");
      return;
    }
    if (["placing", "ready"].includes(game.status)) {
      this.showView("placement");
      if (!this.fleet.length) this.resetFleet();
      this.renderPlacement();
      const me = players.find((player) => player.user_id === this.userId);
      const opponent = players.find((player) => player.user_id !== this.userId);
      if (me?.ready) {
        this.root.querySelector("[data-ready]").disabled = true;
        this.root.querySelector("[data-ready]").textContent = opponent?.ready ? "Starting…" : "Fleet locked";
        this.setStatus("Fleet locked.", "Waiting for the other player to finish placing their ships.");
      } else {
        this.root.querySelector("[data-ready]").textContent = "Lock fleet";
        this.setStatus("Place your fleet.", `${opponent?.ready ? "Your opponent is ready. " : ""}Both fleets must be locked before play starts.`);
      }
      return;
    }
    if (game.status === "active") {
      this.showView("battle");
      this.renderBattle();
      return;
    }
    if (game.status === "completed") {
      this.showView("battle");
      this.renderBattle();
      void this.stopRealtime();
    }
  }

  syncInvitation(game, isHost) {
    const resend = this.root.querySelector("[data-invite-resend]");
    const expired = Date.parse(game.expires_at) <= Date.now();
    if (!isHost || game.status === "completed" || expired) {
      resend.hidden = true;
      if (isHost && (game.status === "completed" || expired)) {
        clearHostInvitation(localStorage, game.id);
        this.inviteUrl = null;
      }
      return;
    }

    if (!this.inviteUrl) this.inviteUrl = loadHostInvitation(localStorage, game.id);
    if (this.inviteUrl) {
      saveHostInvitation(localStorage, { gameId: game.id, url: this.inviteUrl, expiresAt: game.expires_at });
      this.root.querySelector("[data-share-url]").value = this.inviteUrl;
    }
    resend.hidden = !this.inviteUrl || game.status === "waiting";
  }

  async stopRealtime() {
    this.visibilityPause.cancel();
    this.refreshQueue.cancel();
    if (!this.channel) return;
    const channel = this.channel;
    this.channel = null;
    await getSupabase().removeChannel(channel);
    this.setConnection("online", "Complete");
  }

  handleVisibilityChange() {
    const canPause = this.gameId && this.channel && this.state?.game?.status !== "completed";
    this.visibilityPause.setHidden(Boolean(document.hidden && canPause));
  }

  async pauseRealtimeForBackground() {
    if (!document.hidden || !this.channel || this.state?.game?.status === "completed") return;
    this.refreshQueue.cancel();
    const channel = this.channel;
    this.channel = null;
    await getSupabase().removeChannel(channel);
    this.setConnection("idle", "Paused");
  }

  async resumeRealtimeAfterBackground() {
    if (!this.gameId || this.state?.game?.status === "completed") return;
    await this.subscribe();
    await this.refreshQueue.runNow();
  }

  resetFleet() {
    this.fleet = GAME_MODES[this.state.game.mode].fleet.map((length) => ({ length, row: null, col: null, orientation: "h" }));
    this.selectedShip = 0;
  }

  renderPlacement() {
    const config = GAME_MODES[this.state.game.mode];
    const me = this.state.players.find((player) => player.user_id === this.userId);
    const locked = Boolean(me?.ready || this.isLockingFleet);
    if (!this.placementCells.length || this.placementCells.length !== config.size ** 2) {
      this.placementCells = createBoard(this.root.querySelector("[data-placement-board]"), config.size, {
        onSelect: (row, col) => this.placeSelectedShip(row, col), label: "fleet placement"
      });
    }
    this.placementCells.forEach((cell) => {
      cell.className = "board-cell";
      cell.disabled = locked;
    });
    syncBoardTabStops(this.placementCells);
    this.fleet.forEach((ship) => {
      if (ship.row === null) return;
      cellsForShip(ship).forEach(({ row, col }) => cellAt(this.placementCells, config.size, row, col)?.classList.add("is-ship"));
    });

    const list = this.root.querySelector("[data-fleet-list]");
    list.replaceChildren();
    this.fleet.forEach((ship, index) => {
      const row = document.createElement("div");
      const placed = ship.row !== null;
      row.className = `fleet-item${index === this.selectedShip ? " is-selected" : ""}${placed ? " is-placed" : ""}`;
      const button = document.createElement("button");
      button.type = "button";
      button.disabled = locked;
      button.innerHTML = Array.from({ length: ship.length }, () => "<i></i>").join("");
      button.setAttribute("aria-label", `${placed ? "Move" : "Place"} ship length ${ship.length}`);
      button.addEventListener("click", () => { this.selectedShip = index; this.orientation = ship.orientation || "h"; this.renderPlacement(); });
      const status = document.createElement("span");
      status.textContent = placed ? "Placed" : "Unplaced";
      row.append(button, status);
      list.append(row);
    });
    const valid = this.fleet.every((ship) => ship.row !== null) && validateFleet(this.state.game.mode, this.fleet);
    this.root.querySelectorAll("[data-rotate], [data-randomize], [data-clear-fleet]").forEach((button) => { button.disabled = locked; });
    this.root.querySelector("[data-ready]").disabled = !valid || locked;
  }

  placeSelectedShip(row, col) {
    const config = GAME_MODES[this.state.game.mode];
    const index = this.selectedShip >= 0 ? this.selectedShip : this.fleet.findIndex((ship) => ship.row === null);
    if (index < 0) return;
    const candidate = { ...this.fleet[index], row, col, orientation: this.orientation };
    if (!canPlaceShip(candidate, this.fleet, config.size, index)) {
      showToast("That ship does not fit there");
      return;
    }
    this.fleet[index] = candidate;
    this.selectedShip = this.fleet.findIndex((ship) => ship.row === null);
    this.renderPlacement();
  }

  async lockFleet() {
    if (!validateFleet(this.state.game.mode, this.fleet)) return;
    const button = this.root.querySelector("[data-ready]");
    this.isLockingFleet = true;
    this.renderPlacement();
    button.textContent = "Locking…";
    try {
      await this.api.submitFleet(this.gameId, this.fleet);
      await this.refreshQueue.runNow();
      this.isLockingFleet = false;
    } catch (error) {
      this.isLockingFleet = false;
      this.renderPlacement();
      this.fail(error);
    }
  }

  renderBattle() {
    const config = GAME_MODES[this.state.game.mode];
    const completed = this.state.game.status === "completed";
    const myTurn = this.state.game.current_turn === this.userId;
    const banner = this.root.querySelector("[data-turn-banner]");
    this.root.querySelector("[data-battle-actions]").hidden = completed;
    banner.textContent = completed ? "Final positions" : myTurn ? "Your turn" : "Opponent’s turn";
    banner.classList.toggle("is-your-turn", myTurn && !completed);
    this.renderOpponentMoveTime();
    if (!completed) {
      this.setStatus(myTurn ? "Your shot." : "Hold position.", myTurn ? "Choose one untouched square in the opponent’s waters." : "The board will update when your opponent fires.");
    }

    if (!completed && myTurn && !this.wasMyTurn) {
      document.title = "Your turn · Fleet";
      navigator.vibrate?.(100);
    } else if (!completed && !myTurn) document.title = "Waiting · Fleet";
    this.wasMyTurn = myTurn;

    if (!this.targetCells.length || this.targetCells.length !== config.size ** 2) {
      this.targetCells = createBoard(this.root.querySelector("[data-target-board]"), config.size, {
        onSelect: (row, col) => this.fire(row, col), label: "opponent water"
      });
      this.ownCells = createBoard(this.root.querySelector("[data-own-board]"), config.size, { interactive: false, label: "your water" });
    }
    this.targetCells.forEach((cell) => { cell.className = "board-cell"; cell.disabled = completed || !myTurn; });
    this.ownCells.forEach((cell) => cell.className = "board-cell");
    (this.state.own_fleet || []).forEach((ship) => cellsForShip(ship).forEach(({ row, col }) => cellAt(this.ownCells, config.size, row, col).classList.add("is-ship")));
    if (completed) {
      (this.state.opponent_fleet || []).forEach((ship) => cellsForShip(ship).forEach(({ row, col }) => {
        const cell = cellAt(this.targetCells, config.size, row, col);
        cell.classList.add("is-ship");
        cell.setAttribute("aria-label", `${coordinate(row, col)}, revealed ship`);
      }));
    }

    for (const shot of this.state.shots) {
      const own = shotTargetsMe(shot);
      const cell = cellAt(own ? this.ownCells : this.targetCells, config.size, shot.row, shot.col);
      if (!cell) continue;
      cell.classList.remove("is-ship");
      cell.classList.add(`is-${shot.result}`);
      cell.setAttribute("aria-label", `${coordinate(shot.row, shot.col)}, ${shot.result}`);
      if (!own) cell.disabled = true;
    }
    renderAttackProgress(
      this.root.querySelector("[data-opponent-fleet-progress]"),
      config.fleet,
      this.state.shots
    );
    syncBoardTabStops(this.targetCells);

    const resultPanel = this.root.querySelector("[data-result-panel]");
    resultPanel.hidden = !completed;
    if (completed) {
      this.closeResignDialog();
      const result = multiplayerResult(this.state.game, this.userId);
      this.setStatus(result.statusTitle, "Both final fleets remain visible below.");
      this.root.querySelector("[data-result-title]").textContent = result.resultTitle;
      this.root.querySelector("[data-result-copy]").textContent = result.resultCopy;
      this.showResultDialog(result);
      document.title = `${result.won ? "Victory" : "Defeat"} · Fleet`;
    }
  }

  renderOpponentMoveTime() {
    const node = this.root.querySelector("[data-opponent-move-time]");
    const display = opponentMoveTime(this.state?.last_opponent_move_at);
    node.hidden = !display;
    if (!display) return;
    node.textContent = display.text;
    node.dateTime = display.dateTime;
    node.title = display.accessibleText;
    node.setAttribute("aria-label", display.accessibleText);
  }

  showResultDialog(result) {
    if (this.resultDialogDismissed) return;
    const dialog = this.root.querySelector("[data-result-dialog]");
    this.root.querySelector("[data-result-dialog-title]").textContent = result.dialogTitle;
    this.root.querySelector("[data-result-dialog-copy]").textContent = result.dialogCopy;
    if (!dialog.open) dialog.showModal();
  }

  dismissResultDialog() {
    this.resultDialogDismissed = true;
    const dialog = this.root.querySelector("[data-result-dialog]");
    if (dialog.open) dialog.close();
  }

  showResignDialog() {
    if (this.state?.game?.status !== "active") return;
    const dialog = this.root.querySelector("[data-resign-dialog]");
    if (!dialog.open) dialog.showModal();
  }

  closeResignDialog() {
    const dialog = this.root.querySelector("[data-resign-dialog]");
    if (dialog.open) dialog.close();
  }

  async resignGame() {
    if (this.state?.game?.status !== "active") return;
    const button = this.root.querySelector("[data-confirm-resign]");
    button.disabled = true;
    button.textContent = "Resigning…";
    try {
      await this.api.resignGame(this.gameId);
      this.closeResignDialog();
      await this.refreshQueue.runNow();
    } catch (error) {
      this.closeResignDialog();
      showToast(error.message || "The match could not be resigned");
      await this.refreshQueue.runNow();
    } finally {
      button.disabled = false;
      button.textContent = "Resign game";
    }
  }

  async fire(row, col) {
    if (this.state.game.current_turn !== this.userId) return;
    const alreadyShot = hasMyShotAt(this.state.shots, row, col);
    if (alreadyShot) return;
    this.targetCells.forEach((cell) => cell.disabled = true);
    syncBoardTabStops(this.targetCells);
    try {
      const result = await this.api.fireShot(this.gameId, row, col);
      showToast(result.result === "miss" ? "Miss" : result.sunk ? "Ship sunk" : "Hit");
      await this.refreshQueue.runNow();
    } catch (error) {
      showToast(error.message || "Shot could not be sent");
      await this.refreshQueue.runNow();
    }
  }

  showView(name) {
    this.root.querySelectorAll("[data-view]").forEach((view) => { view.hidden = view.dataset.view !== name; });
  }

  setStatus(title, copy) {
    const status = this.root.querySelector("[data-game-status]");
    status.innerHTML = "";
    const strong = document.createElement("strong");
    const span = document.createElement("span");
    strong.textContent = title;
    span.textContent = copy;
    status.append(strong, span);
  }

  setConnection(state, label) {
    const node = this.root.querySelector("[data-connection-state]");
    node.className = `connection-pill is-${state}`;
    node.querySelector("span").textContent = label;
  }

  fail(error) {
    console.error(error);
    this.setConnection("error", "Error");
    this.showView("error");
    this.root.querySelector("[data-error-copy]").textContent = humanError(error);
  }
}

function humanError(error) {
  const message = error?.message || String(error);
  if (message.includes("not configured")) return message;
  if (message.includes("expired")) return "This room has expired. Ask the host to create a new match.";
  if (message.includes("full")) return "Both seats in this room are already occupied.";
  if (message.includes("token")) return "This invitation is invalid or incomplete.";
  if (message.includes("row-level security")) return "The database connection works, but its game policies have not been installed yet.";
  return "The game could not connect to its room. Check the Supabase setup and try again.";
}

if (root) {
  const controller = new MultiplayerController(root);
  controller.start();
}
