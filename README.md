# ChainGuard

ChainGuard is a galaxy-themed, hackathon-ready web dashboard for AI-assisted supply chain disruption detection and route optimization.

## Run locally

```bash
python3 -m http.server 8080
```

Open http://localhost:8080.

## Features included

- Real-time shipment tracker (list + mock map view)
- Disruption alert engine with severity levels
- AI reroute recommendation panel (Anthropic Claude optional, with local fallback)
- Supply chain risk map (graph visualization)
- Predictive analytics charts
- Incident history + searchable playbook
- What-if simulator and supplier scorecard
- Banner notifications for new disruptions

## Notes

- Data is intentionally mocked in `data.json` for fast demo reliability.
- The dashboard uses a dark galaxy palette with black, maroon, purple, and blue tones.
