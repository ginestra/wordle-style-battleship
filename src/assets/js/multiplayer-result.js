export function multiplayerResult(game, userId) {
  const won = game.winner_id === userId;
  if (game.completion_reason === "resignation") {
    return won
      ? {
          won,
          statusTitle: "Victory.",
          resultTitle: "Your opponent resigned.",
          resultCopy: "The match ended early and the win is yours.",
          dialogTitle: "You won.",
          dialogCopy: "Your opponent resigned. Dismiss this message to inspect the final boards."
        }
      : {
          won,
          statusTitle: "Match complete.",
          resultTitle: "You resigned.",
          resultCopy: "The match ended early and your opponent takes the win.",
          dialogTitle: "Match resigned.",
          dialogCopy: "You resigned and your opponent won. Dismiss this message to inspect the final boards."
        };
  }
  return won
    ? {
        won,
        statusTitle: "Victory.",
        resultTitle: "You sank the fleet.",
        resultCopy: "Clean work. The opposing waters are yours.",
        dialogTitle: "You won.",
        dialogCopy: "You found and sank every opposing ship. Dismiss this message to inspect the final boards."
      }
    : {
        won,
        statusTitle: "Match complete.",
        resultTitle: "Your fleet went down.",
        resultCopy: "The other player found every ship first.",
        dialogTitle: "You lost.",
        dialogCopy: "Your opponent found and sank every ship. Dismiss this message to inspect the final boards."
      };
}
