module.exports = {
  v: 3, salary: 185000, salaryDay: 3, openingBalance: 40000, lastRollover: '2026-10',
  prefs: { onboarded: true, lastEnvId: 'e1' },
  envelopes: [
    { id: 'e1', kind: 'spend', name: 'Courses', max: 30000, period: 'month' },
    { id: 'e2', kind: 'spend', name: 'Transport', max: 8000, period: 'month' },
    { id: 'e3', kind: 'spend', name: 'Sorties', max: 3500, period: 'week' },
    { id: 'e4', kind: 'spend', name: 'Coiffeur', max: 3000, period: '2months', anchor: '2026-10-01' },
    { id: 'p1', kind: 'project', name: 'Apport immobilier', target: 1000000, saved: 250000, monthly: 20000, mode: 'active' },
    { id: 'p2', kind: 'project', name: 'Voyage Japon', target: 300000, saved: 50000, monthly: 0, mode: 'plan', deadline: '2027-06' }
  ],
  recurring: [
    { id: 'r1', type: 'expense', label: 'Loyer', amount: 62000, freq: 'month', start: '2026-10-01' },
    { id: 'r2', type: 'expense', label: 'Électricité', amount: 6500, freq: 'month', start: '2026-10-05' },
    { id: 'r3', type: 'expense', label: 'Netflix', amount: 1349, freq: 'month', start: '2026-10-22' },
    { id: 'r4', type: 'expense', label: 'Assurance auto', amount: 48000, freq: 'year', start: '2026-12-20' },
    { id: 'r5', type: 'income', label: 'APL', amount: 15000, freq: 'month', start: '2026-10-05' },
    { id: 'r6', type: 'expense', label: 'Café', amount: 200, freq: 'day', start: '2026-10-12', envId: 'e3' }
  ],
  transactions: [
    { id: 't1', type: 'expense', envId: 'e1', amount: 6420, date: '2026-10-03', note: 'Carrefour' },
    { id: 't2', type: 'expense', envId: 'e1', amount: 9850, date: '2026-10-09', note: 'Marché' },
    { id: 't3', type: 'expense', envId: 'e1', amount: 11200, date: '2026-10-14', note: 'Courses semaine' },
    { id: 't4', type: 'expense', envId: 'e2', amount: 2900, date: '2026-10-08', note: 'Navigo' },
    { id: 't5', type: 'expense', envId: 'e3', amount: 1590, date: '2026-10-13', note: 'Cinéma' },
    { id: 't7', type: 'expense', envId: null, amount: 3490, date: '2026-10-11', note: 'Cadeau' },
    { id: 't8', type: 'income', envId: null, amount: 8000, date: '2026-10-12', note: 'Vente Vinted' },
    { id: 't9', type: 'expense', envId: 'e2', amount: 8500, date: '2026-11-20', note: 'Billet de train' },
    { id: 't10', type: 'expense', envId: null, amount: 15000, date: '2026-12-10', note: 'Cadeaux de Noël' }
  ]
};
