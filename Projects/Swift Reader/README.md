# Swift — High-Throughput RSVP Reading Engine

> A high-throughput RSVP reading engine engineered to eliminate saccadic eye fatigue, bypass subvocalization, and unlock effortless focus.

[![Deploy with Vercel](https://vercel.com/button)](https://swift-reader-rho.vercel.app)

🔗 **Live Deployment:** [https://swift-reader-rho.vercel.app](https://swift-reader-rho.vercel.app)  
📖 **Reader Workspace:** [https://swift-reader-rho.vercel.app/reader.html](https://swift-reader-rho.vercel.app/reader.html)

---

## ⚡ Overview

**Swift** is a client-side speed-reading engine built with vanilla HTML, CSS, and JavaScript. Utilizing **Rapid Serial Visual Presentation (RSVP)** and **Optimal Recognition Point (ORP)** foveal fixation guides, Swift delivers words directly to the cognitive processing center of the eyes, allowing speeds from **60 to 900 WPM** without ocular fatigue.

---

## 🚀 Key Features

* **Optimal Recognition Point (ORP) Anchoring**: High-contrast visual fixation target aligns every word's optical recognition point to eliminate saccadic jumps.
* **Dual Reading Modes**:
  * **RSVP Mode**: Single-word rapid serial presentation with instant cadence adjustment.
  * **Full-Text Mode**: Synchronized paragraph tracking with active-word highlighting and timeline scrub bar.
* **Focus / Zen Mode**: Distraction-free cockpit hiding all toolbars and secondary UI elements for deep reading immersion.
* **Cognitive Pacing Engine**: Calibrated pacing adjustments (60 — 900 WPM) with smart punctuation delays and comma/period breathing room.
* **Swiss-Modernist Brutalist Aesthetic**: Crisp hairline dividers, monochrome technical typography, tabular numerical figures, and responsive fluid layout.
* **Responsive Viewport Calibration**: Clean desktop/tablet experience with dedicated `< 480px` viewport lockout notices advising wider displays for optimal ergonomics.

---

## 📂 Project Structure

```
Swift Reader/
├── index.html        # Editorial landing page & showcase
├── reader.html       # Dual-mode reading workspace
├── style.css         # Swiss brutalist design system & responsive layout engine
├── script.js         # RSVP cadence engine, ORP calculator, and state management
└── README.md         # Project documentation & live deployment link
```

---

## 🌐 Deployment

This project is deployed on **Vercel**:
* **Production Domain:** [https://swift-reader-rho.vercel.app](https://swift-reader-rho.vercel.app)
* **Direct Deployment URL:** [https://swift-reader-nfnaooz95-entropy15.vercel.app](https://swift-reader-nfnaooz95-entropy15.vercel.app)
* **Vercel Project:** `entropy15/swift-reader`

---

## 🛠️ Local Development

To run locally, simply open `index.html` in any modern web browser or serve via a local static file server:

```bash
# Using Python
python -m http.server 3000

# Using Node / npx
npx serve .
```
