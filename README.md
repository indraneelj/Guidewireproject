# 🛡️ GigShield — AI-Powered Parametric Insurance for India's Gig Economy

> Protecting delivery partners of Zomato, Swiggy, Zepto, Amazon & more against income loss from weather, pollution, and social disruptions.

---

## Quick Start (Node.js Only)

```bash
# 1. Navigate to project folder
cd gigshield

# 2. Install dependencies
npm install

# 3. Start the server
npm start

# 4. Open in browser
open http://localhost:4000
```

**Requirements:** Node.js 14+ only. No database. No build step. No environment variables needed.

---

## What is GigShield?

GigShield is a **parametric income insurance platform** built specifically for India's platform-based gig delivery workers. When external disruptions like heavy rain, severe AQI, floods, or bandhs reduce working hours, GigShield automatically detects the event and triggers instant UPI payouts — no claim forms, no waiting.

### The Problem Solved
India has ~15 million gig delivery workers who lose 20–30% of their weekly income during:
- **Weather events** — Heavy rain, floods, extreme heat (>42°C)
- **Air quality** — AQI spikes >300 making outdoor work hazardous  
- **Social disruptions** — Bandhs, curfews, zone closures

GigShield insures the **lost income** (not health, life, accidents, or vehicles).

---

##  Features

### AI-Powered Risk Assessment
- Dynamic risk scoring (0–100) based on city, platform, experience, delivery zone
- Weekly premium calculation: ₹29–₹199/week based on risk profile
- Coverage = 70% of average weekly earnings (auto-calculated)
- Real-time risk factor visualization

### Parametric Automation
- Events auto-detected from IMD/CPCB APIs (mocked for demo)
- Claims auto-triggered for all workers in affected zones
- No documentation required — purely parametric
- Payouts processed in <60 seconds via UPI

### Intelligent Fraud Detection
- **Duplicate claim check** — flags repeat claims within 48 hours (+40 score)
- **Zone validation** — ensures disruption covers worker's city (+50 score)
- **Amount cap** — claims cannot exceed policy coverage (+30 score)
- **New worker flag** — elevated scrutiny for <7 day accounts (+20 score)
- **GPS validation** — location must match registered zone (+35 score)
- Decision logic: Score <30 → Auto Approve | 30–60 → Review | >60 → Reject

### Policy Management
- Weekly pricing model aligned with gig worker pay cycles
- Auto-renewing policies
- Multi-disruption coverage: Weather + Pollution + Social
- Platform-specific risk profiling

### Optimized Onboarding
- 3-step wizard with live AI risk computation
- Instant policy creation post-onboarding
- UPI ID capture for direct payouts
- Mobile-first form design

### Analytics Dashboard
- Workers by platform breakdown
- City coverage heatmap
- Claims by disruption type
- Risk score distribution
- Real-time payout ledger

### Innovative Features
- **Auto-trigger disruption events** that simultaneously pay all affected workers
- **Live ticker** showing real-time disruption alerts
- **Activity feed** showing all platform events in chronological order
- **Fraud score visualizer** with per-claim breakdown

---

## Application Flow

```
Worker Onboards → AI Computes Risk → Weekly Premium Set → Policy Active
                                                              ↓
Disruption Detected (IMD/CPCB) → Zone Match → Fraud Check → Auto-Claim → UPI Payout
```

---

## Pages & Navigation

| Page | Description |
|------|-------------|
| **Dashboard** | Real-time stats, activity feed, disruption alerts |
| **Live Disruptions** | Active events, data source status, trigger new events |
| **Onboard Worker** | 3-step AI-powered registration + policy creation |
| **Workers** | Full registry with risk scores and policy status |
| **Policies** | Active coverage with premiums and validity |
| **Claims** | Full claims pipeline with fraud scores + manual review |
| **Payouts** | UPI transaction ledger with success/failure tracking |
| **Analytics** | Charts: platforms, cities, claim types, risk distribution |
| **Fraud Detection** | Rule engine + flagged claims investigation |

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/workers/onboard` | Register a new gig worker |
| GET | `/api/workers` | List all workers |
| GET | `/api/workers/:id` | Get worker + policies + claims |
| POST | `/api/policies/create` | Create insurance policy |
| GET | `/api/policies` | List all policies |
| POST | `/api/claims/file` | File a claim (manual) |
| GET | `/api/claims` | List all claims |
| POST | `/api/claims/:id/process` | Approve/reject a claim |
| GET | `/api/payouts` | List all payouts |
| POST | `/api/disruptions/trigger` | Trigger a disruption event |
| GET | `/api/disruptions` | List all disruption events |
| GET | `/api/dashboard` | Dashboard statistics |
| GET | `/api/analytics` | Analytics data |
| POST | `/api/seed` | Load demo data |

---

## Pricing Model

```
Base Premium:  ₹49/week
Risk Factor:   0.5 + (riskScore/100)
Earnings Factor: √(avgWeeklyEarnings / ₹3,000)

Final Premium = Base × RiskFactor × EarningsFactor
Range: ₹29 – ₹199 per week

Coverage = 70% of average weekly earnings
```

---

## Tech Stack

- **Runtime:** Node.js (Express.js)
- **Frontend:** Vanilla HTML/CSS/JavaScript (no framework)
- **Data:** In-memory store (resets on server restart)
- **Fonts:** Google Fonts (Syne + DM Sans + DM Mono)
- **APIs:** All mocked/simulated for demo purposes

---

## Demo Walkthrough

1. **Start server** → Visit `http://localhost:3000`
2. Click **" Load Demo Data"** to populate 6 workers with policies
3. Go to **Live Disruptions** → Click **"Trigger Event"** → Enter city & event
4. Watch auto-payouts appear in **Payouts** ledger
5. Go to **Claims** to see fraud scores and auto-approvals
6. Go to **Analytics** for platform/city breakdowns
7. Try **Onboard Worker** for the full 3-step AI journey

---

## Coverage Exclusions (As Required)

- ❌ Health insurance
- ❌ Life insurance  
- ❌ Accident coverage
- ❌ Vehicle repair
- ✅ Income loss only — from weather, AQI, and social disruptions

---

## Innovation Highlights

1. **Zero-touch claims** — Parametric triggers mean workers never file paperwork
2. **Sub-60-second payouts** — UPI enables instant disbursement at scale
3. **ML risk scoring** — City × Platform × Experience × Zone = personalized premium
4. **Weekly cycle alignment** — Premium timing matches gig worker income patterns
5. **Multi-layer fraud** — 5 independent checks prevent gaming the system
6. **Auto-zone matching** — Disruptions automatically identify all eligible workers

---

*Built for India's gig workforce — those who keep our food hot, our packages delivered, and our cities moving.*
