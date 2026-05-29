import os
import osmnx as ox
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PROCESSED = ROOT / "data/processed/osmnx"

def main() -> None:
    PROCESSED.mkdir(parents=True, exist_ok=True)
    # Target file must be jabodetabek.graphml
    target = PROCESSED / "jabodetabek.graphml"

    # Overpass URL from StadiaMaps (StadiaMaps DOES NOT have Overpass API, falling back to OSM public)
    # ox.settings.overpass_url = "https://overpass.stadiamaps.com/api/interpreter?api_key=6502f1dd-58ae-4f38-bed3-a3856773fb10"
    
    # Increase timeout because Jabodetabek is a very large area
    ox.settings.timeout = 1800
    
    try:
        # Bounding box covering Jabodetabek (North, South, East, West)
        # North: -5.9, South: -6.7, East: 107.3, West: 106.4
        graph = ox.graph_from_bbox(
            bbox=(-5.90, -6.70, 107.30, 106.40),
            network_type="drive", simplify=True
        )
        ox.save_graphml(graph, filepath=target)
        print(f"Graph successfully downloaded and saved to {target}")
    except Exception as e:
        print(f"Error downloading graph: {e}")
        raise

if __name__ == "__main__":
    main()
