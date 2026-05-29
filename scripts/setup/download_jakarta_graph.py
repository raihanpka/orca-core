"""Download Jakarta road network via OSMnx for realistic NSGA-II routing.

Downloads the driveable road graph for Jakarta, Indonesia, annotates edges
with speed/travel time estimates, and saves as GraphML for use by
ml/jakarta_graph.py at runtime.

Output: data/templates/jakarta_graph.graphml (~200MB)
Only needs to be run once; the file is cached.

Usage (from repo root):
    make setup-osmnx
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TEMPLATE_DIR = ROOT / "data" / "templates"


def main() -> None:
    import osmnx as ox

    TEMPLATE_DIR.mkdir(parents=True, exist_ok=True)
    out_path = TEMPLATE_DIR / "jakarta_graph.graphml"

    if out_path.exists():
        print(f"Graph already exists at {out_path} — skipping download.")
        return

    print("Downloading Jakarta road network from OpenStreetMap (this may take a few minutes)...")
    G = ox.graph_from_place("Jakarta, Indonesia", network_type="drive")
    G = ox.add_edge_speeds(G)
    G = ox.add_edge_travel_times(G)

    ox.save_graphml(G, out_path)
    print(f"Saved Jakarta graph: {len(G.nodes)} nodes, {len(G.edges)} edges → {out_path}")


if __name__ == "__main__":
    main()
