# Every Dot a World

A website that generates physically consistent exoplanets, generated with Claude's help for an outreach event ([Lacy Veach Day](https://sites.google.com/view/hsgcrobotics/lacy-veach-day?pli=1&authuser=0)) at the IfA. Each planet gets a slowly rotating procedural render (WebGL), its full set of physical properties with the reasoning behind every value, a habitability assessment, the most similar known worlds, a simulated spectrum, and a verdict for each current or planned observatory if the system sat at a distance you choose (default 10 light-years).

Every planet is reproducible from its URL: `index.html#seed=K7QF2M9A&mode=interesting&d=10`.

- `seed` — any string.
- `mode` — `interesting` (default) or `realistic`.
- `d` — distance in light-years for the observability section (1–100).

Keyboard: `n` makes a new planet. Drag the planet to orbit the camera; double-click to reset.

## Modes

- **Realistic** draws one system from occurrence rates: star types from the local census, planets from Kepler/TESS/RV demographics. Most results are sub-Neptunes, cold icy worlds and M-dwarf rocks, as in the real galaxy.
- **Interesting** builds 40 complete systems with the same physics and picks one with probability weighted toward rarer classes and higher habitability. Every result is still a legitimate output of the model; only the selection is biased.

## The model (`js/model.js`)

1. **Star** — class from the 10-pc census (Reylé+21), mass from the IMF, luminosity/radius/Teff from main-sequence relations with brightening over time, an XUV history (saturated at L_X/L_bol ≈ 10⁻³ for t_sat, then ∝ t^-1.5; M dwarfs stay active for Gyr). White dwarfs included.
2. **Orbit** — small-planet periods from Kepler occurrence (dN/dlogP ∝ P^1.5 inside ~10 d, flat beyond); giants from a broken power law peaking near the snow line plus a hot-Jupiter pile-up; eccentricities from the Kipping beta distribution; tidal circularisation.
3. **Bulk structure** — core mass, iron and water fractions; Zeng+16 rocky radii; Lopez & Fortney 2014 H/He envelope radii; energy-limited XUV escape strips envelopes over the star's history, which produces the radius valley (`node tools/test-model.js` prints the histogram). Giants use a mass–radius curve with youth and irradiation inflation.
4. **Habitable zone** — Kopparapu+13/14 with the planet-mass-dependent inner edge.
5. **Atmosphere retention** — a probabilistic cosmic shoreline (Zahnle & Catling 2017) in lifetime XUV fluence vs. escape velocity, consistent with JWST finding hot M-dwarf rocky planets to be bare.
6. **Tides** — Gladman+96 locking timescale; synchronous, 3:2 or pseudo-synchronous spin; atmospheric thermal tides (Leconte+15); eccentricity tidal heating.
7. **Climate state** — runaway greenhouse (Venus-like or steam world), carbonate–silicate thermostat for temperate worlds, unregulated ocean worlds, dry land planets, snowball/ice worlds, Titan-like haze worlds, atmospheric collapse, eyeball/lobster states for locked planets, M-dwarf pre-main-sequence desiccation, hycean candidates, sub-Neptunes with magma oceans, Sudarsky classes I–V and ultra-hot Jupiters.
8. **Magnetism** — rocky dynamo lifetimes depending on mass, iron fraction, tectonic regime and tidal heating; Christensen+09 energy-flux scaling for giants; magnetopause stand-off against the stellar wind.
9. **Habitability** — a transparent product of requirement factors (temperature, atmosphere, water, size) and modifiers (activity, field, rotation, age, orbit), plus the Earth Similarity Index.
10. **Analogues** — nearest neighbours in a catalogue of ~60 Solar System and exoplanet worlds.

`js/observe.js` evaluates TESS, ground RV, Gaia DR4/DR5, JWST (transmission, eclipse, coronagraphy), Roman's coronagraph, PLATO, Ariel, VLT/RISTRETTO, ELT METIS/ANDES/PCS, the Habitable Worlds Observatory, LIFE and radio arrays, with status as of October 2026. `js/spectrum.js` builds transmission and emission spectra from band-averaged molecular opacities with JWST-like noise.

Every derived value records a note and references; the site shows them under "Why these values?". The full reference list is at the bottom of each page and in `js/data.js`.

## Limitations

This is a semi-empirical toy model, not a research code. Scaling laws stand in for climate, interior and chemistry models; molecular bands are smoothed; telescope sensitivities are rough rules of thumb. Contested science (hycean worlds, super-Earth dynamos, the exact cosmic shoreline) is flagged in the notes rather than settled.
