# Stained-glass background study

Picks: **wide-3.webp** and **tall-3.webp**.

Six separate built-in image_gen generations were made: three landscape and three portrait. The owner's photograph was viewed first and actually supplied through referenced_image_paths for every generation. Exact prompts are in prompts.txt. The owner subsequently requested that all six candidates be pushed for the cloud branch to choose. These review files do not replace the current backgrounds.

## Files and native size

- wide-1.webp, wide-2.webp, wide-3.webp: 1672 × 941 pixels each.
- tall-1.webp, tall-2.webp, tall-3.webp: 941 × 1672 pixels each.

These are quality-82 WebP review copies at the unchanged native dimensions. Lossless PNG originals stay outside git. The tool returned approximately 16:9 / 9:16 rather than mathematically exact ratios (1672 / 941 = 1.77683). No cropping, resizing, recoloring, fish or titles were added. The built-in tool exposes no separate quality or resolution setting. Exact original prompts are retained in prompts.txt; their output filenames refer to the local PNG originals.

## Assessment of each try

### wide-1.webp

Very good dark left third, warm amber glow, saturated borders and green feet, three broad fields with no visible figures. However, its sweeping lead lines resemble a modern abstract window rather than the photograph's diaper glass. The texture is excessively cloudy and molten. An unsolicited large sun/tracery assembly reduces the lancets' usable height. Not the pick.

### wide-2.webp

Closer to the reference's historical painted-glass vocabulary: Gothic canopies, yellow-blue diamond ground and dark leadwork. Warmer amber than wide-3. The small repeated edge ornaments and dense lattice are too busy for later fish. The window begins around 29% of the image width, crowding the requested left third. The lancet heads nearly touch the upper edge. Not the pick.

### wide-3.webp — landscape pick

Best fit for the intended composition: uninterrupted dark masonry extends slightly beyond the left third, three broad lancets fill the right side, small inter-head tracery, jewel borders, gold canopies, low green band, no figures. The coarse ground is much calmer than wide-2 and gives later fish the clearest field.

Reference match is moderate, not exact. It retains the black-versus-jewel contrast, large painted geometric pieces and center-lit glass. Its gold is brighter and more uniform than the reference's richer shaded yellow, sometimes approaching bright yellow despite the prompt. Blue is mostly at the field edges rather than scattered through the ground. The canopies and repeats are rather neat and digitally symmetrical. Painted linework is less expressive than the owner's photograph. Ground lead lines remain a strong repeating pattern; it is the calmest geometric option here, not a completely patternless field.

### tall-1.webp

Good broad two-light silhouette and visually circular ray-only sun. Spacious upper dark area, though the sun begins just before the 20% line. Irregular broad panes are calm but read as an abstract modern window, and the material is too cloudy/mineral-like. Not the pick.

### tall-2.webp

Closer diaper ground and handsome warm gold, two broad lights, round ray-only sun, saturated borders and low green feet. More reference-like Gothic detail than tall-3, but the ground is busier and the sun begins at roughly 17% of image height, intruding on the requested empty top fifth. Glass remains too heavily mottled. Not the pick.

### tall-3.webp — portrait pick

Best top-title clearance: luminous glass starts just below the top fifth. Two broad equal lights, ray-only sun that reads as a true circle, two shoulder tracery lights, black surrounding stone, bold jewel borders, coarse empty gold-and-blue diaper and low green feet. No visible people, creatures, plants or text.

Reference match is moderate. Its warm orange-gold and deep blue carry the photograph's luminous dark-church contrast, with large center-bright panes and bold divisions. The lancet crowns are more rounded than the reference's distinctly pointed heads, although the painted inner canopies and outer stone arch retain pointed elements. Blue patches are larger and more regular than ideal; the strong diamond lattice may compete with dark or blue fish. Sun is visually circular, but generated artwork was not geometrically corrected. Texture still looks more regular and digitally brushed than authentic painted glass. The dark stone arch has visible edges within the top area, though the central title region is quiet.

## Iteration decisions

1. First pair emphasized broad empty luminous fields. Both avoided figures, but produced irregular sweeping glazing and overly molten material.
2. Second pair explicitly requested historical diaper diamonds and less mineral texture. This improved the visual vocabulary but made the fields busier; the wide title area and tall top fifth were insufficient.
3. Third pair coarsened the lattice, removed tiny motifs and strengthened title-space boundaries. These are the most usable composition pair, with the limitations above.

All six attempts are retained here for the explicitly requested cloud comparison. After selection, remove the unused review assets and promote the chosen pair to the production asset paths.
