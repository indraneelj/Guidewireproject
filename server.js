const express = require('express');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── In-Memory Data Store ────────────────────────────────────────────────────
const db = {
  workers: [],
  policies: [],
  claims: [],
  disruptions: [],
  payouts: [],
};

// ─── Seed some disruption events ─────────────────────────────────────────────
const disruptionTemplates = [
  { type: 'weather', subtype: 'Heavy Rain', severity: 'HIGH', aqi: null, rainfall: 45, windSpeed: 60, affectedZones: ['Hyderabad', 'Vizag', 'Vijayawada'] },
  { type: 'weather', subtype: 'Extreme Heat', severity: 'MEDIUM', aqi: null, temp: 44, affectedZones: ['Chennai', 'Bengaluru', 'Hyderabad'] },
  { type: 'pollution', subtype: 'Severe AQI', severity: 'HIGH', aqi: 380, affectedZones: ['Delhi', 'Mumbai', 'Lucknow'] },
  { type: 'social', subtype: 'Bandh/Strike', severity: 'HIGH', affectedZones: ['Kolkata', 'Patna', 'Bhopal'] },
  { type: 'weather', subtype: 'Flood Alert', severity: 'CRITICAL', rainfall: 120, affectedZones: ['Mumbai', 'Chennai', 'Hyderabad'] },
  { type: 'social', subtype: 'Curfew', severity: 'CRITICAL', affectedZones: ['Various'] },
];

// Pre-seed a few active disruptions
disruptionTemplates.slice(0, 3).forEach(t => {
  db.disruptions.push({
    id: uuidv4(),
    ...t,
    status: 'ACTIVE',
    startedAt: new Date(Date.now() - Math.random() * 3600000).toISOString(),
    triggeredAt: new Date().toISOString(),
    source: 'IMD/CPCB API',
    confidence: (85 + Math.floor(Math.random() * 14)) + '%',
  });
});

// ─── AI Risk Engine ───────────────────────────────────────────────────────────
function computeRiskScore(worker) {
  let score = 50;
  const city = (worker.city || '').toLowerCase();
  const platform = (worker.platform || '').toLowerCase();
  const experience = parseInt(worker.experience) || 0;
  const avgEarnings = parseInt(worker.avgWeeklyEarnings) || 3000;
  const zone = (worker.deliveryZone || '').toLowerCase();

  // City risk factor
  const highRiskCities = ['mumbai', 'chennai', 'kolkata', 'hyderabad'];
  const medRiskCities = ['bengaluru', 'delhi', 'pune', 'ahmedabad'];
  if (highRiskCities.includes(city)) score += 20;
  else if (medRiskCities.includes(city)) score += 10;

  // Platform risk
  if (['zomato', 'swiggy'].includes(platform)) score += 8; // food = outdoor, more exposure
  if (['zepto', 'blinkit'].includes(platform)) score += 5;

  // Experience reduces risk
  if (experience > 2) score -= 10;
  if (experience > 5) score -= 5;

  // Earnings bracket
  if (avgEarnings > 6000) score += 5; // higher earner = more to lose
  if (avgEarnings < 2000) score -= 5;

  // Zone
  if (zone.includes('coastal') || zone.includes('flood')) score += 15;
  if (zone.includes('industrial')) score += 8;

  score = Math.max(10, Math.min(95, score));
  return score;
}

function computeWeeklyPremium(worker, riskScore) {
  const base = 49; // ₹49 base
  const risk = riskScore / 100;
  const earningsFactor = (parseInt(worker.avgWeeklyEarnings) || 3000) / 3000;
  const premium = Math.round(base * (0.5 + risk) * Math.sqrt(earningsFactor));
  return Math.max(29, Math.min(199, premium));
}

function computeCoverage(worker, premium) {
  const earnings = parseInt(worker.avgWeeklyEarnings) || 3000;
  return Math.round(earnings * 0.7); // 70% of weekly earnings
}

// ─── Fraud Detection ──────────────────────────────────────────────────────────
function fraudCheck(claim, worker) {
  const flags = [];
  let fraudScore = 0;

  // Check: duplicate claims within 48h
  const recent = db.claims.filter(c =>
    c.workerId === claim.workerId &&
    c.status !== 'REJECTED' &&
    Math.abs(new Date(c.createdAt) - new Date()) < 48 * 3600 * 1000
  );
  if (recent.length > 0) { flags.push('DUPLICATE_CLAIM_48H'); fraudScore += 40; }

  // Check: claim without active disruption in worker's zone
  const activeDisruption = db.disruptions.find(d =>
    d.status === 'ACTIVE' &&
    (d.affectedZones.some(z => z.toLowerCase().includes((worker.city || '').toLowerCase())) ||
     d.affectedZones.includes('Various'))
  );
  if (!activeDisruption) { flags.push('NO_ACTIVE_DISRUPTION_IN_ZONE'); fraudScore += 50; }

  // Check: claim amount exceeds policy coverage
  const policy = db.policies.find(p => p.id === claim.policyId);
  if (policy && claim.amount > policy.coverageAmount) {
    flags.push('AMOUNT_EXCEEDS_COVERAGE'); fraudScore += 30;
  }

  // Check: new worker (< 7 days) claiming
  const workerAge = (Date.now() - new Date(worker.joinedAt)) / (1000 * 3600 * 24);
  if (workerAge < 7) { flags.push('NEW_WORKER_SUSPICIOUS_CLAIM'); fraudScore += 20; }

  // Location validation mock
  if (Math.random() < 0.05) { flags.push('LOCATION_MISMATCH'); fraudScore += 35; }

  return { fraudScore: Math.min(100, fraudScore), flags, activeDisruption };
}

// ─── API Routes ───────────────────────────────────────────────────────────────

// Dashboard stats
app.get('/api/dashboard', (req, res) => {
  const totalPremiumCollected = db.policies.reduce((s, p) => s + (p.weeklyPremium * p.weeksActive || p.weeklyPremium), 0);
  const totalPayouts = db.payouts.reduce((s, p) => s + p.amount, 0);
  const activePolicies = db.policies.filter(p => p.status === 'ACTIVE').length;
  const pendingClaims = db.claims.filter(c => c.status === 'PENDING').length;
  const approvedClaims = db.claims.filter(c => c.status === 'APPROVED').length;
  const avgRisk = db.workers.length
    ? Math.round(db.workers.reduce((s, w) => s + (w.riskScore || 50), 0) / db.workers.length)
    : 0;

  res.json({
    totalWorkers: db.workers.length,
    activePolicies,
    totalPremiumCollected,
    totalPayouts,
    pendingClaims,
    approvedClaims,
    avgRiskScore: avgRisk,
    activeDisruptions: db.disruptions.filter(d => d.status === 'ACTIVE').length,
    claimApprovalRate: db.claims.length
      ? Math.round((approvedClaims / db.claims.length) * 100)
      : 0,
    fraudBlocked: db.claims.filter(c => c.status === 'REJECTED' && c.fraudScore > 50).length,
  });
});

// Onboard worker
app.post('/api/workers/onboard', (req, res) => {
  const { name, phone, city, platform, experience, avgWeeklyEarnings, deliveryZone, upiId } = req.body;
  if (!name || !phone || !city || !platform) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const existing = db.workers.find(w => w.phone === phone);
  if (existing) return res.status(409).json({ error: 'Worker already registered', worker: existing });

  const riskScore = computeRiskScore(req.body);
  const worker = {
    id: uuidv4(),
    name, phone, city, platform, experience, avgWeeklyEarnings,
    deliveryZone: deliveryZone || city,
    upiId: upiId || `${phone}@upi`,
    riskScore,
    riskCategory: riskScore < 40 ? 'LOW' : riskScore < 65 ? 'MEDIUM' : 'HIGH',
    joinedAt: new Date().toISOString(),
    status: 'ACTIVE',
  };
  db.workers.push(worker);
  res.json({ success: true, worker });
});

// Get worker
app.get('/api/workers/:id', (req, res) => {
  const worker = db.workers.find(w => w.id === req.params.id || w.phone === req.params.id);
  if (!worker) return res.status(404).json({ error: 'Worker not found' });
  const policies = db.policies.filter(p => p.workerId === worker.id);
  const claims = db.claims.filter(c => c.workerId === worker.id);
  res.json({ worker, policies, claims });
});

// Get all workers
app.get('/api/workers', (req, res) => {
  res.json(db.workers);
});

// Create policy
app.post('/api/policies/create', (req, res) => {
  const { workerId, planType } = req.body;
  const worker = db.workers.find(w => w.id === workerId);
  if (!worker) return res.status(404).json({ error: 'Worker not found' });

  const existingActive = db.policies.find(p => p.workerId === workerId && p.status === 'ACTIVE');
  if (existingActive) return res.status(409).json({ error: 'Active policy already exists', policy: existingActive });

  const weeklyPremium = computeWeeklyPremium(worker, worker.riskScore);
  const coverageAmount = computeCoverage(worker, weeklyPremium);

  const policy = {
    id: uuidv4(),
    workerId,
    workerName: worker.name,
    city: worker.city,
    platform: worker.platform,
    planType: planType || 'STANDARD',
    weeklyPremium,
    coverageAmount,
    riskScore: worker.riskScore,
    status: 'ACTIVE',
    coverageStart: new Date().toISOString(),
    coverageEnd: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
    weeksActive: 1,
    disruptionTypes: ['weather', 'pollution', 'social'],
    autoRenew: true,
    createdAt: new Date().toISOString(),
  };
  db.policies.push(policy);
  res.json({ success: true, policy });
});

// Get all policies
app.get('/api/policies', (req, res) => {
  res.json(db.policies);
});

// File claim
app.post('/api/claims/file', (req, res) => {
  const { workerId, policyId, disruptionId, description, estimatedLoss, proofType } = req.body;
  const worker = db.workers.find(w => w.id === workerId);
  const policy = db.policies.find(p => p.id === policyId && p.status === 'ACTIVE');
  if (!worker) return res.status(404).json({ error: 'Worker not found' });
  if (!policy) return res.status(404).json({ error: 'Active policy not found' });

  const disruption = db.disruptions.find(d => d.id === disruptionId || d.status === 'ACTIVE');

  const claimData = {
    workerId, policyId,
    amount: Math.min(parseInt(estimatedLoss) || policy.coverageAmount, policy.coverageAmount),
    createdAt: new Date().toISOString(),
  };

  const { fraudScore, flags, activeDisruption } = fraudCheck(claimData, worker);

  const claim = {
    id: uuidv4(),
    workerId,
    workerName: worker.name,
    policyId,
    disruptionId: disruptionId || (activeDisruption?.id),
    disruptionType: activeDisruption?.subtype || 'Unknown',
    description: description || 'Parametric disruption claim',
    estimatedLoss: claimData.amount,
    amount: claimData.amount,
    fraudScore,
    fraudFlags: flags,
    proofType: proofType || 'AUTO_PARAMETRIC',
    status: fraudScore > 60 ? 'REJECTED' : fraudScore > 30 ? 'UNDER_REVIEW' : 'APPROVED',
    autoProcessed: fraudScore <= 30,
    createdAt: new Date().toISOString(),
    processedAt: fraudScore <= 30 ? new Date().toISOString() : null,
    rejectionReason: fraudScore > 60 ? `Fraud detected: ${flags.join(', ')}` : null,
  };
  db.claims.push(claim);

  // Auto payout if approved
  if (claim.status === 'APPROVED') {
    const payout = {
      id: uuidv4(),
      claimId: claim.id,
      workerId,
      amount: claim.amount,
      upiId: worker.upiId,
      method: 'UPI',
      status: 'SUCCESS',
      txnId: 'GS' + Math.random().toString(36).substr(2, 10).toUpperCase(),
      processedAt: new Date().toISOString(),
    };
    db.payouts.push(payout);
    claim.payoutId = payout.id;
    claim.payoutTxnId = payout.txnId;
  }

  res.json({ success: true, claim });
});

// Get all claims
app.get('/api/claims', (req, res) => {
  res.json(db.claims);
});

// Approve/reject claim manually
app.post('/api/claims/:id/process', (req, res) => {
  const claim = db.claims.find(c => c.id === req.params.id);
  if (!claim) return res.status(404).json({ error: 'Claim not found' });
  const { action } = req.body;
  claim.status = action === 'approve' ? 'APPROVED' : 'REJECTED';
  claim.processedAt = new Date().toISOString();
  if (claim.status === 'APPROVED' && !claim.payoutId) {
    const worker = db.workers.find(w => w.id === claim.workerId);
    const payout = {
      id: uuidv4(), claimId: claim.id, workerId: claim.workerId,
      amount: claim.amount, upiId: worker?.upiId || 'unknown@upi',
      method: 'UPI', status: 'SUCCESS',
      txnId: 'GS' + Math.random().toString(36).substr(2, 10).toUpperCase(),
      processedAt: new Date().toISOString(),
    };
    db.payouts.push(payout);
    claim.payoutId = payout.id;
    claim.payoutTxnId = payout.txnId;
  }
  res.json({ success: true, claim });
});

// Get disruptions
app.get('/api/disruptions', (req, res) => {
  res.json(db.disruptions);
});

// Trigger disruption (mock real-time event)
app.post('/api/disruptions/trigger', (req, res) => {
  const { type, subtype, severity, affectedZones, aqi, rainfall, temp } = req.body;
  const disruption = {
    id: uuidv4(),
    type: type || 'weather',
    subtype: subtype || 'Heavy Rain',
    severity: severity || 'HIGH',
    aqi: aqi || null,
    rainfall: rainfall || null,
    temp: temp || null,
    affectedZones: affectedZones || ['Hyderabad'],
    status: 'ACTIVE',
    startedAt: new Date().toISOString(),
    triggeredAt: new Date().toISOString(),
    source: 'IMD/Mock API',
    confidence: (85 + Math.floor(Math.random() * 14)) + '%',
  };
  db.disruptions.push(disruption);

  // Auto-trigger parametric claims for affected workers
  const affected = db.workers.filter(w =>
    disruption.affectedZones.some(z =>
      z.toLowerCase().includes(w.city.toLowerCase()) ||
      w.city.toLowerCase().includes(z.toLowerCase())
    ) || disruption.affectedZones.includes('Various')
  );

  const autoClaims = [];
  affected.forEach(worker => {
    const policy = db.policies.find(p => p.workerId === worker.id && p.status === 'ACTIVE');
    if (!policy) return;
    const existing = db.claims.find(c =>
      c.workerId === worker.id &&
      c.disruptionId === disruption.id
    );
    if (existing) return;

    const claim = {
      id: uuidv4(),
      workerId: worker.id,
      workerName: worker.name,
      policyId: policy.id,
      disruptionId: disruption.id,
      disruptionType: disruption.subtype,
      description: `Auto-triggered: ${disruption.subtype} in ${disruption.affectedZones.join(', ')}`,
      estimatedLoss: policy.coverageAmount,
      amount: policy.coverageAmount,
      fraudScore: 0,
      fraudFlags: [],
      proofType: 'AUTO_PARAMETRIC',
      status: 'APPROVED',
      autoProcessed: true,
      createdAt: new Date().toISOString(),
      processedAt: new Date().toISOString(),
    };
    const payout = {
      id: uuidv4(), claimId: claim.id, workerId: worker.id,
      amount: claim.amount, upiId: worker.upiId, method: 'UPI', status: 'SUCCESS',
      txnId: 'GS' + Math.random().toString(36).substr(2, 10).toUpperCase(),
      processedAt: new Date().toISOString(),
    };
    db.payouts.push(payout);
    claim.payoutId = payout.id;
    claim.payoutTxnId = payout.txnId;
    db.claims.push(claim);
    autoClaims.push(claim);
  });

  res.json({ success: true, disruption, affectedWorkers: affected.length, autoClaims: autoClaims.length });
});

// Get payouts
app.get('/api/payouts', (req, res) => {
  res.json(db.payouts);
});

// Analytics
app.get('/api/analytics', (req, res) => {
  const byPlatform = {};
  db.workers.forEach(w => {
    if (!byPlatform[w.platform]) byPlatform[w.platform] = { workers: 0, premium: 0 };
    byPlatform[w.platform].workers++;
  });
  db.policies.forEach(p => {
    if (byPlatform[p.platform]) byPlatform[p.platform].premium += p.weeklyPremium;
  });

  const byCity = {};
  db.workers.forEach(w => {
    byCity[w.city] = (byCity[w.city] || 0) + 1;
  });

  const claimsByType = {};
  db.claims.forEach(c => {
    claimsByType[c.disruptionType] = (claimsByType[c.disruptionType] || 0) + 1;
  });

  res.json({ byPlatform, byCity, claimsByType, totalPayouts: db.payouts.reduce((s, p) => s + p.amount, 0) });
});

// Seed demo data
app.post('/api/seed', (req, res) => {
  const demoWorkers = [
    { name: 'Ravi Kumar', phone: '9876543210', city: 'Hyderabad', platform: 'Zomato', experience: '3', avgWeeklyEarnings: '4200', deliveryZone: 'Banjara Hills', upiId: '9876543210@paytm' },
    { name: 'Suresh Babu', phone: '9876543211', city: 'Mumbai', platform: 'Swiggy', experience: '1', avgWeeklyEarnings: '3800', deliveryZone: 'Andheri West', upiId: '9876543211@gpay' },
    { name: 'Priya Sharma', phone: '9876543212', city: 'Delhi', platform: 'Zepto', experience: '2', avgWeeklyEarnings: '3200', deliveryZone: 'Connaught Place', upiId: '9876543212@phonepe' },
    { name: 'Arjun Nair', phone: '9876543213', city: 'Bengaluru', platform: 'Blinkit', experience: '4', avgWeeklyEarnings: '5100', deliveryZone: 'Koramangala', upiId: '9876543213@upi' },
    { name: 'Deepak Yadav', phone: '9876543214', city: 'Chennai', platform: 'Amazon', experience: '2', avgWeeklyEarnings: '3600', deliveryZone: 'Anna Nagar', upiId: '9876543214@paytm' },
    { name: 'Kavya Reddy', phone: '9876543215', city: 'Hyderabad', platform: 'Dunzo', experience: '1', avgWeeklyEarnings: '2800', deliveryZone: 'Gachibowli', upiId: '9876543215@gpay' },
  ];

  const created = [];
  demoWorkers.forEach(w => {
    if (!db.workers.find(x => x.phone === w.phone)) {
      const riskScore = computeRiskScore(w);
      const worker = {
        id: uuidv4(), ...w, riskScore,
        riskCategory: riskScore < 40 ? 'LOW' : riskScore < 65 ? 'MEDIUM' : 'HIGH',
        joinedAt: new Date(Date.now() - Math.random() * 30 * 24 * 3600 * 1000).toISOString(),
        status: 'ACTIVE',
      };
      db.workers.push(worker);

      const weeklyPremium = computeWeeklyPremium(worker, riskScore);
      const coverageAmount = computeCoverage(worker, weeklyPremium);
      const policy = {
        id: uuidv4(), workerId: worker.id, workerName: worker.name,
        city: worker.city, platform: worker.platform, planType: 'STANDARD',
        weeklyPremium, coverageAmount, riskScore, status: 'ACTIVE',
        coverageStart: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
        coverageEnd: new Date(Date.now() + 4 * 24 * 3600 * 1000).toISOString(),
        weeksActive: 1, disruptionTypes: ['weather', 'pollution', 'social'],
        autoRenew: true, createdAt: new Date().toISOString(),
      };
      db.policies.push(policy);
      created.push(worker.name);
    }
  });

  res.json({ success: true, created, total: db.workers.length });
});

// Catch-all
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🛡️  GigShield AI Insurance Platform`);
  console.log(`✅  Server running at http://localhost:${PORT}`);
  console.log(`📊  Dashboard: http://localhost:${PORT}`);
  console.log(`\n   Built for India's Gig Economy\n`);
});
