# Rest Stop: Karen's Watching

A single-player, 2-D side-scrolling comedy game.

> You had a plan. You had a *binder*. Then your bladder had other ideas.

## About

You're an obsessively over-prepared road-tripper driving your three dogs to your
sister's vacation home, where your whole weekend getaway is about to begin. You
do **not** drive at night — those back roads are pitch-black and easy to get lost
on — so the entire trip is engineered to arrive before dark. Then your bladder
forces an unscheduled stop at a roadside rest stop, and your perfect plan
collapses into chaos: three escaped dogs, a sad patch of grass, and one very
determined stranger who thinks she knows exactly what kind of person you are.

*Rest Stop: Karen's Watching* is a single-level comedy of errors where
**daylight is everything** — every fumble, every escaped dog, every accident
burns the sunlight you need to reach your sister's place before nightfall
swallows the roads and leaves you hopelessly lost. Whatever daylight you've
still got banked when you pull out of that lot is your score.

## Characters

- **The Planner (you):** a control freak with a color-coded itinerary, undone by
  the two most uncontrollable forces on earth — their own body and a dog.
- **The Labrador — the Puller:** big, friendly menace. Once leashed, *it* drags
  *you* toward people. You have to steer it away from trouble.
- **The Staffordshire Terrier — the Lightning Rod:** a total marshmallow,
  unfairly profiled as "scary." The moment Karen sees him, her panic spikes. Keep
  him out of her sightline.
- **The Chihuahua — the Runner:** tiny, fast, erratic. The escape artist who
  bolts. You have to corner it.
- **Karen — the antagonist:** leaps to the worst conclusion with zero facts. She
  panics over climate-controlled dogs she thinks are being neglected, and recoils
  at the sweetest dog on the lot. Every rest stop in America has one.

## How It Plays

1. **The Gamble.** Your pee meter is climbing on the highway. Pull over now at the
   unscheduled stop (safe, small daylight cost) or risk it and push for the
   scheduled stop (bank bonus daylight, or have an accident and lose).
2. **The Quick Break.** Dash to the restroom, leaving the dogs safe in the locked,
   climate-controlled car. While you're away, the dogs' poop meter climbs and
   Karen may notice the unattended dogs.
3. **The Dog Gauntlet.** Let the dogs out and wrangle all three: corner the
   Chihuahua, steer the Lab, hide the Staffie. Get a dog to do its business in the
   designated zone and scoop it before Karen's meter fills.
4. **The Getaway.** Botch it — a dog poops in the wrong spot, poop left unscooped,
   the Staffie spotted too long, or the Lab body-slams Karen — and she calls the
   cops. Now get yourself and all three dogs back in the car and leave before the
   squad car arrives.

## Controls

| Key | Action |
|-----|--------|
| Left / Right (or A / D) | Walk |
| Shift (hold) | Run |
| Spacebar | Context action (enter, grab, lead/drop, stay, scoop, load, drive) |
| Esc | Pause |

**The gamble:** Left = pull over now, Right = keep driving.
**Menus:** arrows to highlight, Enter to select.
**High-score initials:** Left/Right pick a slot, Up/Down change the letter, Enter to confirm.

## Scoring & Endgame

- **Score:** daylight remaining when you reach your sister's vacation home.
- **Win:** arrive before dark.
- **Lose:** the sun sets first (you get lost), the pee meter fills (accident), or
  the cops catch you.

## Screens

- **Title screen** — start the game and view controls.
- **Gameplay screen** — play the level (with the daylight clock and meters).
- **High Scores screen** — top scores with editable three-character initials.

## Tech

Browser-based (HTML / CSS / JavaScript). High scores persist locally via the
browser's `localStorage` — no internet connection or cloud storage required.

## Play

- **Online:** https://dblminttwin.github.io/rest-stop-karens-watching/
  (served from this repo via GitHub Pages — may take a minute to go live after a push)
- **Locally:** download or clone the repo and open `index.html` in any modern
  browser. No server or install is needed; everything runs in the browser and
  scores save to your own machine. (You can also run `python3 -m http.server`
  in the folder and visit the printed URL.)

## Status

Playable. Built as a self-contained HTML5 canvas game and verified to run
cleanly through every screen and gameplay phase.
