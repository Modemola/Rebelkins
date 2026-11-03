# Rejected side-view sheets

Kept so the numbers quoted in `ART-BRIEF-SIDE.md` §6.2 can be re-derived
rather than taken on trust:

    node tools/sidecheck.mjs assets/sheets/side/rejected/kin06-attempt2.webp

| file | gap | depth | why |
|---|---|---|---|
| `kin06-attempt2.webp` | 36.5% | 0.7% | Second attempt at KIN 06, after his style note was corrected. Head in profile, chest square to camera, legs splayed wider than the front-on art being replaced. Not the style note's fault: the prompt itself asked for a wide symmetric guard and a band of background between the legs, both of which are front-view geometry. See §1 of the brief. |

The first KIN 06 attempt (33% / 0%) was not kept; its numbers are recorded
in the brief only. The third attempt, against the corrected prompt, measured
17.4% and was accepted — it is `assets/sheets/side/kin06.webp`.

These numbers moved slightly (37.5% to 36.5%) when `sidecheck` changed how it
separates the feet: it used to look for two connected blobs, and the accepted
KIN 06 broke it, because his platform soles abut and the two feet are one
blob while being perfectly distinct to look at. It now splits the foot band
down its emptiest column instead, which works either way.
