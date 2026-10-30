# Third-party notices

RNSpectraX™ is © 2026 Rakesh Naik and Sachin Kumar Srivastava, all rights
reserved (see [`LICENSE`](LICENSE)). It uses the third-party components below,
each under its own licence. Those licences cover the components only, not
RNSpectraX itself.

The JavaScript libraries are **not copied into this repository**: the browser
loads them from public CDNs (cdnjs.cloudflare.com and cdn.plot.ly) when the app
or its guide opens, in exactly the published versions listed here. The
reference spectral library **is** included (adapted), under the Open Database
License.

| Component | Version | Licence | Used for | Loaded from |
|---|---|---|---|---|
| [Plotly.js](https://github.com/plotly/plotly.js) | 2.35.2 | MIT | All plots | cdn.plot.ly |
| [jsPDF](https://github.com/parallax/jsPDF) | 2.5.1 | MIT | PDF export of peak and comparison tables | cdnjs |
| [MathJax](https://github.com/mathjax/MathJax) | 2.7.9 | Apache 2.0 | LaTeX in plot titles and axis labels | cdnjs |
| [KaTeX](https://github.com/KaTeX/KaTeX) | 0.16.9 | MIT | Typeset equations in the app and the methods guide | cdnjs |
| [SheetJS Community Edition (xlsx)](https://git.sheetjs.com/sheetjs/sheetjs) | 0.18.5 | Apache 2.0 | Reading Excel / OpenDocument files (loaded only when one is opened) | cdnjs |
| [RamanBiolib](https://github.com/mteranm/ramanbiolib) (data) | database files retrieved 21 Oct 2026 | ODbL 1.0 | Reference spectra for *Identify* | included: [`data/`](data/) |

Visit counting uses the hosted [GoatCounter](https://www.goatcounter.com)
service (its `count.js` is loaded from gc.zgo.at). It sets no cookies and
receives no data from your files; it is a service, not part of the app's code.

The live "using now" count connects to a hosted
[Supabase Realtime](https://supabase.com) channel with a random per-tab number;
it is a service, not part of the app's code.

---

## Plotly.js 2.35.2 — MIT License

Copyright (c) 2021 Plotly, Inc

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## jsPDF 2.5.1 — MIT License

Copyright
(c) 2010-2021 James Hall, https://github.com/MrRio/jsPDF
(c) 2015-2021 yWorks GmbH, https://www.yworks.com/

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## KaTeX 0.16.9 — MIT License

Copyright (c) 2013-2020 Khan Academy and other contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## MathJax 2.7.9 — Apache License 2.0

Copyright (c) 2009-2020 The MathJax Consortium

Licensed under the Apache License, Version 2.0 (the "License"); you may not
use this file except in compliance with the License. You may obtain a copy of
the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
License for the specific language governing permissions and limitations under
the License.

## SheetJS Community Edition (xlsx) 0.18.5 — Apache License 2.0

Copyright (C) 2012-present SheetJS LLC

Licensed under the Apache License, Version 2.0 (the "License"); you may not
use this file except in compliance with the License. You may obtain a copy of
the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
License for the specific language governing permissions and limitations under
the License.

## RamanBiolib reference spectra — Open Database License (ODbL) 1.0

`data/ramanbiolib.js` is an adapted (re-formatted) copy of the database files
of RamanBiolib, <https://github.com/mteranm/ramanbiolib>, made available under
the Open Database License v1.0. The full licence is in
[`data/LICENSE-ODbL`](data/LICENSE-ODbL) and at
<https://opendatacommons.org/licenses/odbl/1-0/>; the source, adaptation and
citation are described in [`data/README.md`](data/README.md). The adapted
database is likewise available under the ODbL v1.0. The single-file build
(`dist/rnspectrax-standalone.html`) embeds the same data with this notice.

Please cite: M. Terán, J. J. Ruiz, P. Loza-Alvarez, D. Masip, D. Merino.
*Open Raman spectral library for biomolecule identification.* Chemometrics and
Intelligent Laboratory Systems **264**, 105476 (2025).
<https://doi.org/10.1016/j.chemolab.2025.105476>

Each reference spectrum was digitized by the RamanBiolib authors from a figure
in a published article; that article's DOI is kept with the spectrum and shown
with every match.

---

Questions about licensing or permission to use RNSpectraX: rakesh_n@cpqct.iitr.ac.in
