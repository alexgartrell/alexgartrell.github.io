# Reversi

Black moves first. A move must bracket one or more opponent discs in a straight
line. All bracketed discs flip. A player with no legal move passes automatically;
the game ends when neither player can move. The larger disc count wins.

The computer plays white. Normal and Hard use two- and three-ply minimax with
alpha-beta pruning, corner preference, and mobility evaluation. Two-player mode
uses the same board locally. Undo in computer mode returns to the previous human
turn, including any computer moves after it.

No network requests or external dependencies are used.
