# Reference spectral library

`ramanbiolib.js` contains the reference Raman spectra used by RNSpectraX's
**library match** (Raman mode → Identify).

## Source

**RamanBiolib** — an open Raman spectral library for biomolecule
identification (202 spectra of 141 biomolecules: proteins, lipids,
saccharides, amino acids, nucleic acids, primary metabolites, pigments,
vitamins), from the database files of
<https://github.com/mteranm/ramanbiolib>, retrieved 21 October 2026.

Please cite:

> M. Terán, J. J. Ruiz, P. Loza-Alvarez, D. Masip, D. Merino. *Open Raman
> spectral library for biomolecule identification.* Chemometrics and
> Intelligent Laboratory Systems **264**, 105476 (2025).
> <https://doi.org/10.1016/j.chemolab.2025.105476>

Each spectrum in RamanBiolib was digitized from a figure in a published
article; that article's DOI is stored with the spectrum and is shown, with
the library citation, next to every match.

## Licence

The RamanBiolib database is made available under the **Open Database
License (ODbL) v1.0** — see [`LICENSE-ODbL`](LICENSE-ODbL). `ramanbiolib.js`
is an adaptation of that database and is likewise licensed under the ODbL
v1.0. This licence applies to the data files in this folder only; it does
not change the licence of RNSpectraX itself.

## Changes made in the adaptation

- The three CSV files (spectra, peaks, metadata) were merged into one
  JavaScript data file.
- Intensities (already smoothed, baseline-removed, interpolated to
  450–1800 cm⁻¹ at 1 cm⁻¹ and min–max normalised by the RamanBiolib authors)
  are stored as integers 0–1000 (= intensity × 1000).
- Only the metadata fields needed for display were kept: component, class,
  source reference (DOI), excitation wavelength, Raman technique, data origin
  and sample name.
- A formatted reference was added for the six source articles that supply
  most of the spectra.
