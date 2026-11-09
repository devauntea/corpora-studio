# Pattern starters and preview sizing

Form Studio provides male and female S, M and L starter profiles for exploring all 65 bundled FreeSewing designs. They are commercial-chart-based drafting examples, **not personal measurements, population averages, guaranteed fit or a universal sizing standard**. The picker labels them **Male starter** and **Female starter**. They use the reference heights documented below without claiming to represent an average person. Any profile can be used with any design; selecting one does not restrict garment categories.

## Sources and landmark mapping

Checked 6 November 2026 against the publisher’s [Simplicity size charts](https://simplicity.com/size-charts/). Values use its centimetre columns converted to millimetres. S/M/L use the upper numbered size in each corresponding publisher band:

| Profile  | Publisher size | Chest / bust | Waist | Full seat | High bust |
| -------- | -------------- | -----------: | ----: | --------: | --------: |
| Male S   | Men 36         |          920 |   760 |       940 | estimated |
| Male M   | Men 40         |         1020 |   870 |      1040 | estimated |
| Male L   | Men 44         |         1120 |   990 |      1140 | estimated |
| Female S | Misses 10      |          830 |   640 |       880 |       780 |
| Female M | Misses 14      |          920 |   710 |       970 |       870 |
| Female L | Misses 18      |         1020 |   810 |      1070 |       970 |

All table values are millimetres. Male reference height is 1778 mm (the chart’s 5 ft 10 in). Female reference height is 1660 mm, the midpoint of its 165–167 cm range. Female center-back waist lengths are 405/420/430 mm; male neckband values are 370/395/420 mm. Those last two rows are inputs to estimates, **not silently equated with HPS-to-waist or bare-neck circumference**.

Landmarks follow [FreeSewing’s measurement definitions](https://freesewing.eu/docs/measurements/). In particular, [high hips](https://freesewing.eu/docs/measurements/hips/) means the top of the hip bones; [seat](https://freesewing.eu/docs/measurements/seat/) means the fullest buttock circumference. The publisher’s hip measurement maps to `seat`, never to `hips`. Its shirt-sleeve length is not used as shoulder-tip-to-wrist.

FreeSewing [explains why it removed its own “standard” measurements](https://freesewing.eu/docs/about/faq/standard-measurements/): such figures created unjustified fit expectations. These profiles therefore expose chart values and estimates separately and ask users to confirm actual measurements and fit a toile. They are not certified EN/ISO/ASTM tables.

## Derived estimates

The chart does not contain every input the 65 designs require. Form Studio supplies the following **documented preview assumptions**, rather than leaving hidden gaps or claiming the missing values were measured. They are intentionally simple proportions; they are not published anthropometric regressions. `C`, `W`, `S`, `H` mean chest/bust, waist, full seat and reference height. Derived values are rounded to 0.1 mm for reproducibility, not to imply physical accuracy.

| Measurement             | Preview formula / assumption                               |
| ----------------------- | ---------------------------------------------------------- |
| Male high bust          | C − 20                                                     |
| High hips               | W + 0.65 × (S − W)                                         |
| Biceps                  | C × 0.326 male; C × 0.32 female                            |
| Neck                    | Male published neckband − 10; female high bust × 0.39      |
| Shoulder width          | C × 0.42                                                   |
| HPS to bust             | C × 0.27 male; C × 0.293 female                            |
| HPS to waist back       | H × 0.259 male; published back-waist length + 15 female    |
| Waist to armpit         | HPS-to-waist back × 0.435                                  |
| Waist to high hips      | H × 0.072                                                  |
| Shoulder to wrist       | H × 0.35                                                   |
| Wrist                   | H × 0.096 male; H × 0.09 female                            |
| Shoulder slope          | 13°, a neutral drafting assumption                         |
| Back seat arc           | S × 0.52                                                   |
| Back waist arc          | W × 0.50                                                   |
| Seated crotch depth     | H × 0.17                                                   |
| Total crotch length     | 2 × crotch depth + W × 0.16                                |
| Front crotch length     | Total crotch length × 0.46                                 |
| Knee                    | S × 0.39                                                   |
| Waist to floor          | H × 0.61                                                   |
| Waist to knee           | Waist-to-floor × 0.57                                      |
| Waist to full seat      | H × 0.132                                                  |
| Waist to upper leg      | Crotch depth + 20                                          |
| Ankle                   | H × 0.13                                                   |
| Front bust arc          | C × 0.51 male; C × 0.54 female                             |
| Bust point to underbust | C × 0.06 male; C × 0.095 female                            |
| Bust span               | C × 0.215                                                  |
| Head                    | H × 0.32 male; H × 0.335 female                            |
| Heel                    | H × 0.19                                                   |
| Front high-bust arc     | High bust × 0.50                                           |
| HPS to front waist      | HPS-to-waist back + 10 male; + 25 female                   |
| Inseam                  | Waist-to-floor − crotch depth                              |
| Shoulder to elbow       | Shoulder-to-wrist × 0.55                                   |
| Underbust               | C − 60 male; C − 110 female                                |
| Upper thigh             | S × 0.58                                                   |
| Waist to underbust      | HPS-to-front-waist − HPS-to-bust − bust-point-to-underbust |

The browser’s “Measurement sources & estimates” disclosure shows the value, source class and formula for each input needed by the selected pattern. Source notes also travel with starter profiles saved in the project.

## Safe preview and application

“Browse 65 drafted patterns” opens an independent preview. Cards use real FreeSewing cut, stitch and guide geometry, generated locally from the selected profile. Search matches the name, garment description and category. Visible cards draft lazily; a 48-entry LRU cache bounds stored SVG previews.

Changing the preview’s body or S/M/L size leaves the current project untouched. “Use this pattern” applies the selected profile only when its checkbox is enabled. The previous measurements are saved in project profiles, the applied starter’s provenance is saved alongside them, and the change can be undone. If the 20-profile limit would prevent keeping both, application stops with a clear message. It does not overwrite an old profile.

Manual construction pieces, their formula links, layout positions, seam plans, notes, vectors and existing profiles are retained. Formula-linked coordinates can follow the new measurements; fixed manual geometry does not auto-grade. Recheck joining seams after every size change. Changing the template clears the active imported-piece-only view while keeping the imported work saved.

The existing garment selector remains available. It does not automatically replace saved personal measurements. Use the preview’s starter option to fill a complete measurement set, or enter missing personal measurements directly.

## What the previews prove—and what they do not

Automated validation drafts **65 designs × 6 profiles = 390 combinations**, checks every required measurement is present, verifies finite exported SVG geometry and positive piece dimensions, and checks all 38 fields have provenance. Separate tests cover work preservation, full-profile-library refusal and distinct real preview geometry.

This confirms software compatibility, not sewing or fitting approval. Some designs target a specific body feature or age group. In particular, **Otis is a baby romper**: adult profiles demonstrate its parameterized geometry only; measure the child before making it. Bust-sensitive designs require individual bust and arc measurements. These starter assumptions do not establish a cup size.

The catalog previews are 2D pattern layouts, not invented finished-garment renderings. Existing 3D drape tools remain available from the workspace for supported prepared panels. Automatic stitched 3D clothing for every catalog design is not delivered by this sizing work.

## Verification evidence

- 465 sizing and existing catalog unit checks passed, including all 390 profile/design combinations and profile-preservation checks.
- Eight focused Chromium/WebKit browser tests passed across the starter workflow, existing catalog/size-series interchange and pattern/vector task navigation. The new workflow checks staging, custom-piece retention, save/undo/reopen, accessibility and a 1100 × 760 window. Additional checks cover the unfiltered 65-card grid so its preview rows cannot collapse into clipped strips.
- TypeScript passed after integration with project format 19. Existing format-18 measurement data is preserved by the project migration; only new studies receive the complete default starter profile.
- A single local development run measured 129 ms from clicking the browser entry to the first visible drafted card, with six card images loaded initially. This includes automation overhead and is not a sustained performance benchmark. No page errors or horizontal document overflow were observed. Details: `qa/final-development/pattern-preview-check.json`.
- Reviewed screenshots: `qa/final-development/pattern-browser-webkit-1440.png`, `pattern-browser-webkit-1100.png`, and `pattern-workspace-webkit-1100.png`.
- Production-build and native desktop verification are performed separately during final integration; these results describe the targeted development checks.
