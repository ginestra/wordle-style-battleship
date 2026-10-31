import { copyText, showToast } from "./ui.js";
import { GAME_MODES, canPlaceShip, cellAt, cellsForShip, coordinate, createBoard, randomFleet, validateFleet } from "./game-rules.js";
import { ensureAnonymousSession, getSupabase, rpc } from "./supabase-client.js";

const root = document.querySelector("[data-multiplayer-root]");

class MultiplayerController {
  constructor(element) {
    this.root = element;
    this.mode = "quick";
    this.gameId = null;
    this.userId = null;
    this.state = null;
    this.channel = null;
    this.fleet = [];
    this.selectedShip = 0;
    this.orientation = "h";
    this.wasMyTurn = false;
    this.placementCells = [];
    this.targetCells = [];
    this.ownCells = [];
  }

  async start() {
    this.bindControls();
    try {
      const session = await ensureAnonymousSession();
      this.userId = session.user.id;
      this.setConnection("online", "Connected");
      const invitation = parseInvitation();
      if (invitation.gameId) {
        this.gameId = invitation.gameId;
        if (invitation.joinToken) await rpc("join_game", { p_game_id: this.gameId, p_join_token: invitation.joinToken });
        window.history.replaceState(null, "", `${location.pathname}#game=${encodeURIComponent(this.gameId)}`);
        await this.subscribe();
        await this.refresh();
      }
    } catch (error) {
      this.fail(error);
    }
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
    this.root.querySelector("[data-copy-link]").addEventListener("click", () => copyText(this.root.querySelector("[data-share-url]").value, "Invitation copied"));
    this.root.querySelector("[data-rotate]").addEventListener("click", () => { this.orientation = this.orientation === "h" ? "v" : "h"; showToast(`Ships place ${this.orientation === "h" ? "horizontally" : "vertically"}`); });
    this.root.querySelector("[data-randomize]").addEventListener("click", () => { this.fleet = randomFleet(this.state.game.mode); this.selectedShip = -1; this.renderPlacement(); });
    this.root.querySelector("[data-clear-fleet]").addEventListener("click", () => { this.resetFleet(); this.renderPlacement(); });
    this.root.querySelector("[data-ready]").addEventListener("click", () => this.lockFleet());
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
      const created = await rpc("create_game", { p_mode: this.mode, p_host_name: hostName });
      this.gameId = created.game_id;
      const hostUrl = `${location.pathname}#game=${encodeURIComponent(this.gameId)}`;
      const inviteUrl = `${location.origin}${location.pathname}#game=${encodeURIComponent(this.gameId)}&join=${encodeURIComponent(created.join_token)}`;
      window.history.replaceState(null, "", hostUrl);
      this.root.querySelector("[data-room-code]").textContent = created.room_code;
      this.root.querySelector("[data-share-url]").value = inviteUrl;
      await this.subscribe();
      await this.refresh();
    } catch (error) {
      button.disabled = false;
      button.textContent = "Create private match";
      this.fail(error);
    }
  }

  async subscribe() {
    if (this.channel) await getSupabase().removeChannel(this.channel);
    this.channel = getSupabase()
      .channel(`game:${this.gameId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "games", filter: `id=eq.${this.gameId}` }, () => this.refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "game_players", filter: `game_id=eq.${this.gameId}` }, () => this.refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "shots", filter: `game_id=eq.${this.gameId}` }, () => this.refresh())
      .subscribe((status) => {
        if (status === "SUBSCRIBED") this.setConnection("online", "Live");
        if (["CHANNEL_ERROR", "TIMED_OUT"].includes(status)) this.setConnection("error", "Reconnecting");
      });
  }

  async refresh() {
    try {
      const state = await rpc("get_game_state", { p_game_id: this.gameId });
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
    }
  }

  resetFleet() {
    this.fleet = GAME_MODES[this.state.game.mode].fleet.map((length) => ({ length, row: null, col: null, orientation: "h" }));
    this.selectedShip = 0;
  }

  renderPlacement() {
    const config = GAME_MODES[this.state.game.mode];
    if (!this.placementCells.length || this.placementCells.length !== config.size ** 2) {
      this.placementCells = createBoard(this.root.querySelector("[data-placement-board]"), config.size, {
        onSelect: (row, col) => this.placeSelectedShip(row, col), label: "fleet placement"
      });
    }
    this.placementCells.forEach((cell) => cell.className = "board-cell");
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
      button.innerHTML = Array.from({ length: ship.length }, () => "<i></i>").join("");
      button.setAttribute("aria-label", `${placed ? "Move" : "Place"} ship length ${ship.length}`);
      button.addEventListener("click", () => { this.selectedShip = index; this.orientation = ship.orientation || "h"; this.renderPlacement(); });
      const status = document.createElement("span");
      status.textContent = placed ? "Placed" : "Unplaced";
      row.append(button, status);
      list.append(row);
    });
    const valid = this.fleet.every((ship) => ship.row !== null) && validateFleet(this.state.game.mode, this.fleet);
    const me = this.state.players.find((player) => player.user_id === this.userId);
    this.root.querySelector("[data-ready]").disabled = !valid || Boolean(me?.ready);
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
    button.disabled = true;
    button.textContent = "Locking…";
    try {
      await rpc("submit_fleet", { p_game_id: this.gameId, p_ships: this.fleet });
      await this.refresh();
    } catch (error) {
      button.disabled = false;
      this.fail(error);
    }
  }

  renderBattle() {
    const config = GAME_MODES[this.state.game.mode];
    const completed = this.state.game.status === "completed";
    const myTurn = this.state.game.current_turn === this.userId;
    const banner = this.root.querySelector("[data-turn-banner]");
    banner.textContent = completed ? "Final positions" : myTurn ? "Your turn — choose one square" : "Opponent’s turn";
    banner.classList.toggle("is-your-turn", myTurn && !completed);
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
      const own = shot.target_id === this.userId;
      const cell = cellAt(own ? this.ownCells : this.targetCells, config.size, shot.row, shot.col);
      if (!cell) continue;
      cell.classList.remove("is-ship");
      cell.classList.add(`is-${shot.result}`);
      cell.setAttribute("aria-label", `${coordinate(shot.row, shot.col)}, ${shot.result}`);
      if (!own) cell.disabled = true;
    }

    const resultPanel = this.root.querySelector("[data-result-panel]");
    resultPanel.hidden = !completed;
    if (completed) {
      const won = this.state.game.winner_id === this.userId;
      this.setStatus(won ? "Victory." : "Match complete.", "Both final fleets remain visible below.");
      this.root.querySelector("[data-result-title]").textContent = won ? "You sank the fleet." : "Your fleet went down.";
      this.root.querySelector("[data-result-copy]").textContent = won ? "Clean work. The opposing waters are yours." : "The other player found every ship first.";
      document.title = `${won ? "Victory" : "Defeat"} · Fleet`;
    }
  }

  async fire(row, col) {
    if (this.state.game.current_turn !== this.userId) return;
    const alreadyShot = this.state.shots.some((shot) => shot.shooter_id === this.userId && shot.row === row && shot.col === col);
    if (alreadyShot) return;
    this.targetCells.forEach((cell) => cell.disabled = true);
    try {
      const result = await rpc("fire_shot", { p_game_id: this.gameId, p_row: row, p_col: col });
      showToast(result.result === "miss" ? "Miss" : result.sunk ? "Ship sunk" : "Hit");
      await this.refresh();
    } catch (error) {
      showToast(error.message || "Shot could not be sent");
      await this.refresh();
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

function parseInvitation() {
  const parameters = new URLSearchParams(location.hash.replace(/^#/, ""));
  return { gameId: parameters.get("game"), joinToken: parameters.get("join") };
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
