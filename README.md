# UNCUED

Four small grid games that tell you nothing. No tutorial, no goal text, no
legend. You get a board and four arrow keys, and you work out the rule by
pushing buttons and watching what changes.

Play: **https://ragnarpitla.github.io/uncued/**

That is the format ARC Prize uses for ARC-AGI-3, where the point is measuring
how fast something learns a system it has never seen. These are my own games,
not copies of theirs.

## The four

| id | name | what it says on the card |
|----|------|--------------------------|
| ls01 | LOCKSTEP | Two bodies. One input. |
| ch02 | CHROMA | You are a colour. |
| tl03 | TILT | Nothing here takes one step. |
| ec04 | ECHO | It is one move behind you. |

Five levels each. That is the entire documentation, and it is deliberate.

## Scoring

Finishing is not the score. Efficiency is.

```
level_score = min(1.15, (par / your_actions) ^ 2)
game_score  = level scores averaged, weighted by level number
```

Squaring is what makes it bite: take twice par and you get 0.25, not 0.5. The
weighting means level 5 counts five times as much as level 1, so finishing four
of five caps you at 66.7 percent however well you played. Undo counts as an
action.

That is the ARC-AGI-3 rule. **One difference, and it matters.** ARC's baseline
is the median of about 500 human players. Nobody has played these games yet, so
par here is optimal play, found by breadth-first search over the whole state
space. Optimal par is a harder yardstick than a human median. Scoring 1.0 means
you matched a solver that sees every move at once.

## How the levels are made

No level is drawn by hand. I tried that first and 8 of 20 came out unsolvable,
because in a game where a mirrored body has to desync on a wall you cannot eyeball
whether a target is reachable.

`tools/gen.mjs` instead searches the real state space from the real start and
picks the goal from a state it has already proven reachable. Solvability becomes
structural rather than something to test for, and par falls out exact. It is
seeded, so it reproduces byte for byte.

```
node tools/gen.mjs     # write js/levels.js
node tools/solve.mjs   # re-derive every par independently, write js/par.json
node tools/qa.mjs      # replay every solution in a real browser
```

## What the checks are actually for

A green run only means something if it could have gone red. Each gate carries
controls that fail in opposite directions:

- **A** a synthetic corridor of length 7 must solve in exactly 7 - catches a
  solver that never finds anything.
- **B** the same corridor with the win state removed must be reported
  unsolvable - catches a solver that claims everything is solved.
- **C** `solve.mjs` walks the same game modules the browser runs, while
  `gen.mjs` derived par with separate code. They must agree on all 20 levels.
- **D** playing par plus a wasted move and an undo must score below 1.0 -
  catches scoring that ignores how many actions you spent.
- **E** a deliberately wrong sequence must not win - catches a page that
  celebrates anything.

Control C earned its place. It caught the generator overstating par on 8 levels:
CHROMA keys its search on position and colour but wins on position alone, so
taking the depth of any one winning state instead of the shortest gave CHROMA L1
a par of 10 when the exit was 4 moves away. Par feeds the score, so that would
have handed every player 2.5x the points they earned. Same bug in ECHO, whose
search key carries the last move but whose win condition does not. Fixed by
collapsing to the shortest route per win-group, and the two implementations now
agree on every level.

Two more bugs got through every automated check and were caught only by looking
at the frames: the game list stayed visible under an open game because
`display: grid` beats the `hidden` attribute, and the player dot vanished
whenever it stood on a cell of its own colour, which in CHROMA is every single
door.

## Running it

No build step. It is plain ES modules, so any static server works.

```
python3 -m http.server 8000
```

Tools need Node 18+ and, for `qa.mjs`, Playwright with Chrome.

## Licence

MIT. See `LICENSE`.

## Spoilers

`tools/par.json` holds the optimal solution to every level, because `qa.mjs`
replays them. Do not open it before you play.
