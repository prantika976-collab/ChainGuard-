const state = {
  shipments: [],
  alerts: [],
  incidents: [],
  suppliers: [],
  selectedShipment: null,
  mapView: false
};

const statusClass = {
  'on-time': 'status-green',
  'at-risk': 'status-yellow',
  disrupted: 'status-red'
};

async function init() {
  const res = await fetch('./data.json');
  const data = await res.json();
  state.shipments = data.shipments;
  state.alerts = data.alerts;
  state.incidents = data.incidents;
  state.suppliers = data.suppliers;

  wireEvents();
  renderKPIs();
  renderShipments();
  renderAlerts();
  renderRiskMap();
  renderHistory();
  renderSupplierScores();
  renderCharts();
  pushBanner('🚨 Disruption event injected: Rotterdam customs strike');
}

function wireEvents() {
  document.getElementById('toggleViewBtn').addEventListener('click', () => {
    state.mapView = !state.mapView;
    renderShipments();
  });

  document.getElementById('generateAiBtn').addEventListener('click', generateAiReroutes);
  document.getElementById('historySearch').addEventListener('input', renderHistory);
  document.getElementById('runSim').addEventListener('click', runSimulation);
}

function renderKPIs() {
  const total = state.shipments.length || 1;
  const onTime = state.shipments.filter((s) => s.status === 'on-time').length;
  const atRisk = state.shipments.filter((s) => s.status !== 'on-time').length;

  document.getElementById('onTimeRate').textContent = `${Math.round((onTime / total) * 100)}%`;
  document.getElementById('activeAlerts').textContent = state.alerts.length;
  document.getElementById('atRiskCount').textContent = atRisk;
}

function renderShipments() {
  const host = document.getElementById('shipmentView');
  host.innerHTML = '';

  if (state.mapView) {
    const mapMock = document.createElement('div');
    mapMock.innerHTML = `<img alt="world map" style="width:100%;border-radius:10px;border:1px solid rgba(145,130,230,.35);" src="https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=1200&q=80" /><p class="small-note">Mock lane map view: click list mode for per-shipment actions.</p>`;
    host.appendChild(mapMock);
    return;
  }

  const t = document.getElementById('shipmentTemplate');
  state.shipments.forEach((shipment) => {
    const clone = t.content.cloneNode(true);
    clone.querySelector('h3').textContent = shipment.id;
    clone.querySelector('.status-dot').classList.add(statusClass[shipment.status]);
    clone.querySelector('.meta').textContent = `${shipment.route} • ${shipment.carrier}`;
    clone.querySelector('.eta').textContent = `ETA: ${new Date(shipment.eta).toLocaleString()} • ${shipment.location}`;
    clone.querySelector('.details-btn').addEventListener('click', () => {
      state.selectedShipment = shipment;
      pushBanner(`Selected ${shipment.id}. Ready for reroute AI.`);
      renderReroutes(getFallbackReroutes(shipment));
    });
    host.appendChild(clone);
  });
}

function renderAlerts() {
  const host = document.getElementById('alertFeed');
  host.innerHTML = '';
  state.alerts.forEach((alert) => {
    const div = document.createElement('div');
    div.className = `alert ${alert.severity}`;
    div.innerHTML = `<strong>${alert.title}</strong><p class="small-note">${alert.impact}</p><small>${alert.time}</small>`;
    host.appendChild(div);
  });
}

function getFallbackReroutes(shipment) {
  if (!shipment) {
    return [{
      route: 'Select a disrupted shipment',
      tradeoff: 'Then click “Generate AI Reroutes”.',
      cost: '-',
      eta: '-',
      risk: '-'
    }];
  }

  return [
    {route: `${shipment.route} via alternate west-coast port`, tradeoff: 'Best speed / medium cost', cost: '+$900', eta: '-10h', risk: 'Medium'},
    {route: `${shipment.route} with air-sea split`, tradeoff: 'Fastest but expensive', cost: '+$2,300', eta: '-19h', risk: 'Low'},
    {route: `${shipment.route} defer + rail consolidation`, tradeoff: 'Cheapest, slower', cost: '-$450', eta: '+8h', risk: 'High'}
  ];
}

function renderReroutes(options) {
  const host = document.getElementById('rerouteCards');
  host.innerHTML = '';
  options.forEach((option, idx) => {
    const card = document.createElement('div');
    card.className = 'reroute';
    card.innerHTML = `<strong>#${idx + 1} ${option.route}</strong>
      <p class="small-note">${option.tradeoff}</p>
      <p>Cost: ${option.cost} • Time: ${option.eta} • Risk: ${option.risk}</p>
      <button class="soft-btn">Approve Route</button>`;
    host.appendChild(card);
  });
}

async function generateAiReroutes() {
  const apiKey = document.getElementById('apiKey').value.trim();
  const shipment = state.selectedShipment || state.shipments.find((s) => s.status === 'disrupted');

  if (!shipment) {
    pushBanner('No shipment available for AI analysis.');
    return;
  }

  if (!apiKey) {
    renderReroutes(getFallbackReroutes(shipment));
    pushBanner('Showing local AI mock reroutes (API key not provided).');
    return;
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-latest',
        max_tokens: 450,
        messages: [{
          role: 'user',
          content: `You are a supply chain disruption analyst. Shipment context: ${JSON.stringify(shipment)}. Return 3 ranked reroute options as compact JSON array with keys route, tradeoff, cost, eta, risk.`
        }]
      })
    });

    const payload = await response.json();
    const text = payload?.content?.[0]?.text || '';
    const parsed = JSON.parse(text.match(/\[.*\]/s)?.[0] || '[]');

    if (!parsed.length) {
      throw new Error('No structured reroutes returned.');
    }

    renderReroutes(parsed);
    pushBanner(`Claude reroutes ready for ${shipment.id}`);
  } catch (error) {
    console.error(error);
    renderReroutes(getFallbackReroutes(shipment));
    pushBanner('Claude request failed. Fallback reroutes shown.');
  }
}

function renderRiskMap() {
  const svg = document.getElementById('riskMap');
  const nodes = [
    { id: 'Supplier A', x: 60, y: 200, risk: 'low' },
    { id: 'Supplier B', x: 130, y: 90, risk: 'medium' },
    { id: 'Port LA', x: 300, y: 150, risk: 'high' },
    { id: 'Port Rotterdam', x: 460, y: 100, risk: 'high' },
    { id: 'Warehouse TX', x: 620, y: 210, risk: 'medium' },
    { id: 'Distribution Hub', x: 790, y: 140, risk: 'low' }
  ];

  const edges = [
    [0, 2], [1, 3], [2, 4], [3, 4], [4, 5]
  ];

  const color = { low: '#48dfb7', medium: '#ffd56f', high: '#ff6b8e' };
  svg.innerHTML = '';

  edges.forEach(([a, b]) => {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', nodes[a].x);
    line.setAttribute('y1', nodes[a].y);
    line.setAttribute('x2', nodes[b].x);
    line.setAttribute('y2', nodes[b].y);
    line.setAttribute('stroke', 'rgba(152,130,228,.45)');
    line.setAttribute('stroke-width', '2');
    svg.appendChild(line);
  });

  nodes.forEach((node) => {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', node.x);
    circle.setAttribute('cy', node.y);
    circle.setAttribute('r', 14);
    circle.setAttribute('fill', color[node.risk]);
    circle.setAttribute('stroke', '#1e1738');
    circle.setAttribute('stroke-width', '3');
    svg.appendChild(circle);

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', node.x - 30);
    text.setAttribute('y', node.y + 28);
    text.textContent = node.id;
    svg.appendChild(text);
  });
}

function renderHistory() {
  const query = document.getElementById('historySearch')?.value?.toLowerCase() ?? '';
  const host = document.getElementById('incidentHistory');
  host.innerHTML = '';

  state.incidents
    .filter((item) => `${item.date} ${item.event} ${item.resolution} ${item.outcome}`.toLowerCase().includes(query))
    .forEach((item) => {
      const div = document.createElement('div');
      div.className = 'incident';
      div.innerHTML = `<strong>${item.date} — ${item.event}</strong><p class="small-note">${item.resolution}</p><small>${item.outcome}</small>`;
      host.appendChild(div);
    });
}

function renderSupplierScores() {
  const host = document.getElementById('supplierScores');
  host.innerHTML = '';
  state.suppliers.forEach((supplier) => {
    const wrapper = document.createElement('div');
    wrapper.style.marginBottom = '0.5rem';
    wrapper.innerHTML = `<div style="display:flex;justify-content:space-between;font-size:.85rem"><span>${supplier.name}</span><span>${supplier.reliability}%</span></div>
      <div style="height:9px;background:rgba(255,255,255,.08);border-radius:999px;overflow:hidden">
        <div style="height:100%;width:${supplier.reliability}%;background:linear-gradient(90deg,#7f61ff,#4bc8ff)"></div>
      </div>`;
    host.appendChild(wrapper);
  });
}

function renderCharts() {
  drawBarChart(
    document.getElementById('carrierChart'),
    [
      ['NovaFreight', 91],
      ['BlueArc', 84],
      ['TerraLine', 88],
      ['PolarTransit', 86]
    ],
    '#8f63ff'
  );

  drawBarChart(
    document.getElementById('delayChart'),
    [
      ['Pacific lane', 18],
      ['EU lane', 22],
      ['Domestic rail', 11],
      ['Middle East lane', 9]
    ],
    '#51a4ff'
  );
}

function drawBarChart(canvas, rows, color) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const max = Math.max(...rows.map((r) => r[1]));

  rows.forEach((row, i) => {
    const [label, value] = row;
    const x = 18 + i * 90;
    const height = (value / max) * 140;

    ctx.fillStyle = 'rgba(255,255,255,.75)';
    ctx.font = '12px Inter';
    ctx.fillText(label, x - 8, 205);

    ctx.fillStyle = color;
    ctx.fillRect(x, 180 - height, 56, height);

    ctx.fillStyle = '#e7e3ff';
    ctx.fillText(String(value), x + 18, 170 - height);
  });
}

function runSimulation() {
  const scenario = document.getElementById('simScenario').value;
  const output = document.getElementById('simResult');

  const responses = {
    storm: 'Cascade forecast: 6 shipments impacted, +14.2h avg delay, reroute via Anchorage reduces disruption by 41%.',
    strike: 'Cascade forecast: 4 EU shipments impacted, customs backlog risk high. Pre-clearance reduces SLA breach by 28%.',
    breakdown: 'Cascade forecast: 3 inland shipments impacted. Backup carrier activation recovers 8.6h.'
  };

  output.textContent = responses[scenario];
  pushBanner('What-if simulation completed.');
}

function pushBanner(text) {
  const host = document.getElementById('bannerHost');
  const banner = document.createElement('div');
  banner.className = 'banner';
  banner.textContent = text;
  host.prepend(banner);

  setTimeout(() => {
    banner.remove();
  }, 4600);
}

init();
